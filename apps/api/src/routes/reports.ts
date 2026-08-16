import type { FastifyInstance } from "fastify";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { createReportRequestSchema, createReportShareRequestSchema } from "@evidera/contracts";
import { issues, organizations, reportShares, reports, sites, withTenant, type DatabaseClient } from "@evidera/database";
import { AppError, createOpaqueToken, hashToken, type ApiEnvironment } from "@evidera/runtime";
import { requireRole } from "../plugins/auth.js";
import type { AuditLogService } from "../services/auditLogService.js";

export async function registerReportRoutes(app: FastifyInstance, options: { database: DatabaseClient; environment: ApiEnvironment; auditLog: AuditLogService }): Promise<void> {
  const s3 = new S3Client({ endpoint: options.environment.S3_ENDPOINT, region: options.environment.S3_REGION, forcePathStyle: options.environment.S3_FORCE_PATH_STYLE, credentials: { accessKeyId: options.environment.S3_ACCESS_KEY, secretAccessKey: options.environment.S3_SECRET_KEY } });
  app.get<{ Params: { siteId: string } }>("/api/sites/:siteId/reports", { preHandler: requireRole() }, async (request) => {
    const auth = request.auth; if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    return withTenant(options.database.db, auth.organizationId, (tx) => tx.select().from(reports).where(and(eq(reports.organizationId, auth.organizationId), eq(reports.siteId, request.params.siteId))).orderBy(desc(reports.createdAt)).limit(50));
  });
  app.post("/api/reports", { preHandler: requireRole("analyst"), config: { rateLimit: { max: 30, timeWindow: "1 hour" } } }, async (request, reply) => {
    const auth = request.auth; if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const input = createReportRequestSchema.parse(request.body);
    const source = await withTenant(options.database.db, auth.organizationId, async (tx) => {
      const site = await tx.query.sites.findFirst({ where: and(eq(sites.id, input.siteId), eq(sites.organizationId, auth.organizationId)) });
      const organization = await tx.query.organizations.findFirst({ where: eq(organizations.id, auth.organizationId) });
      if (!site || !organization) throw new AppError("Site bulunamadı.", "SITE_NOT_FOUND", 404);
      const findings = await tx.select().from(issues).where(and(eq(issues.siteId, site.id), sql`${issues.state} not in ('resolved', 'false_positive')`)).orderBy(desc(issues.lastSeenAt)).limit(100);
      return { site, organization, findings };
    });
    const pdf = await renderPdf({ title: input.title, kind: input.kind, organization: source.organization.name, site: source.site.name, origin: source.site.origin, findings: source.findings });
    const reportId = crypto.randomUUID(); const key = `${auth.organizationId}/${input.siteId}/reports/${reportId}.pdf`;
    await s3.send(new PutObjectCommand({ Bucket: options.environment.S3_BUCKET, Key: key, Body: pdf, ContentType: "application/pdf", ...(options.environment.S3_SERVER_SIDE_ENCRYPTION === "AES256" ? { ServerSideEncryption: "AES256" as const } : {}) }));
    const report = await withTenant(options.database.db, auth.organizationId, async (tx) => (await tx.insert(reports).values({ id: reportId, organizationId: auth.organizationId, siteId: input.siteId, createdByUserId: auth.userId, title: input.title, kind: input.kind, status: "ready", artifactKey: key }).returning())[0]);
    if (!report) throw new AppError("Rapor kaydedilemedi.", "REPORT_CREATE_FAILED", 500);
    await options.auditLog.write(request, "report.created", "report", report.id, { siteId: input.siteId, kind: input.kind });
    return reply.code(201).send(report);
  });
  app.get<{ Params: { reportId: string } }>("/api/reports/:reportId/download", { preHandler: requireRole() }, async (request, reply) => {
    const auth = request.auth; if (!auth) throw new AppError("Oturum gerekli.", "AUTH_REQUIRED", 401);
    const report = await withTenant(options.database.db, auth.organizationId, (tx) => tx.query.reports.findFirst({ where: and(eq(reports.id, request.params.reportId), eq(reports.organizationId, auth.organizationId)) }));
    if (!report?.artifactKey) throw new AppError("Rapor bulunamadı.", "REPORT_NOT_FOUND", 404);
    const object = await s3.send(new GetObjectCommand({ Bucket: options.environment.S3_BUCKET, Key: report.artifactKey }));
    if (!object.Body) throw new AppError("Rapor dosyası bulunamadı.", "REPORT_ARTIFACT_NOT_FOUND", 404);
    reply.header("content-type", "application/pdf").header("content-disposition", `attachment; filename="${safeFilename(report.title)}.pdf"`).header("cache-control", "private, no-store");
    return reply.send(object.Body as NodeJS.ReadableStream);
  });
  app.post<{ Params: { reportId: string } }>("/api/reports/:reportId/share", { preHandler: requireRole("consultant") }, async (request, reply) => {
    const auth=request.auth;if(!auth)throw new AppError("Oturum gerekli.","AUTH_REQUIRED",401);const input=createReportShareRequestSchema.parse(request.body);const token=createOpaqueToken();const tokenHash=hashToken(token,options.environment.SESSION_SECRET);const expiresAt=new Date(Date.now()+input.expiresInDays*86_400_000);
    const share=await withTenant(options.database.db,auth.organizationId,async(tx)=>{const report=await tx.query.reports.findFirst({where:and(eq(reports.id,request.params.reportId),eq(reports.organizationId,auth.organizationId))});if(!report)throw new AppError("Rapor bulunamadı.","REPORT_NOT_FOUND",404);return(await tx.insert(reportShares).values({organizationId:auth.organizationId,reportId:report.id,tokenHash,expiresAt,createdByUserId:auth.userId}).returning({id:reportShares.id}))[0];});
    if(!share)throw new AppError("Paylaşım oluşturulamadı.","REPORT_SHARE_FAILED",500);await options.auditLog.write(request,"report.shared","report",request.params.reportId,{shareId:share.id,expiresAt:expiresAt.toISOString()});return reply.code(201).send({id:share.id,url:`${options.environment.PUBLIC_APP_URL}/api/public/reports/${token}`,expiresAt:expiresAt.toISOString()});
  });
  app.delete<{ Params: { shareId: string } }>("/api/report-shares/:shareId", { preHandler: requireRole("consultant") }, async (request,reply)=>{const auth=request.auth;if(!auth)throw new AppError("Oturum gerekli.","AUTH_REQUIRED",401);const row=await options.database.db.update(reportShares).set({revokedAt:new Date()}).where(and(eq(reportShares.id,request.params.shareId),eq(reportShares.organizationId,auth.organizationId))).returning({id:reportShares.id});if(!row[0])throw new AppError("Paylaşım bulunamadı.","REPORT_SHARE_NOT_FOUND",404);await options.auditLog.write(request,"report.share_revoked","report_share",request.params.shareId,{});return reply.code(204).send();});
  app.get<{ Params: { token: string } }>("/api/public/reports/:token", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request,reply)=>{if(request.params.token.length>256)throw new AppError("Paylaşım bulunamadı.","REPORT_SHARE_NOT_FOUND",404);const tokenHash=hashToken(request.params.token,options.environment.SESSION_SECRET);const share=await options.database.db.query.reportShares.findFirst({where:and(eq(reportShares.tokenHash,tokenHash),isNull(reportShares.revokedAt),gt(reportShares.expiresAt,new Date()))});if(!share)throw new AppError("Paylaşım bulunamadı veya süresi doldu.","REPORT_SHARE_NOT_FOUND",404);const report=await withTenant(options.database.db,share.organizationId,(tx)=>tx.query.reports.findFirst({where:eq(reports.id,share.reportId)}));if(!report?.artifactKey)throw new AppError("Rapor bulunamadı.","REPORT_NOT_FOUND",404);const object=await s3.send(new GetObjectCommand({Bucket:options.environment.S3_BUCKET,Key:report.artifactKey}));if(!object.Body)throw new AppError("Rapor dosyası bulunamadı.","REPORT_ARTIFACT_NOT_FOUND",404);reply.header("content-type","application/pdf").header("content-disposition",`inline; filename="${safeFilename(report.title)}.pdf"`).header("cache-control","private, no-store").header("x-robots-tag","noindex, nofollow, noarchive");return reply.send(object.Body as NodeJS.ReadableStream);});
  app.addHook("onClose", async () => s3.destroy());
}

async function renderPdf(input: { title: string; kind: string; organization: string; site: string; origin: string; findings: Array<typeof issues.$inferSelect> }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 48, info: { Title: input.title, Author: input.organization } }); const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk)); document.on("error", reject); document.on("end", () => resolve(Buffer.concat(chunks)));
    document.font("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf").fontSize(9).fillColor("#6e6e73").text(input.organization.toUpperCase()); document.moveDown(.5).fontSize(25).fillColor("#1d1d1f").text(input.title); document.moveDown(.5).fontSize(10).fillColor("#6e6e73").text(`${input.site} · ${input.origin} · ${new Date().toLocaleDateString("tr-TR")} · ${input.kind}`);
    document.moveDown(1.5).fontSize(14).fillColor("#1d1d1f").text("Kanıtlı bulgular"); document.moveDown(.5).fontSize(9).fillColor("#6e6e73").text("Bu rapor yalnızca dışarıdan doğrulanabilen sinyalleri içerir. GSC, Analytics veya reklam hesabı sonucu iddia edilmez.");
    for (const [index, finding] of input.findings.entries()) { if (document.y > 720) document.addPage(); document.moveDown(1).fontSize(11).fillColor("#1d1d1f").text(`${index + 1}. ${finding.title}`); document.fontSize(8).fillColor("#6e6e73").text(`${finding.severity.toUpperCase()} · ${finding.confidence} · ${finding.affectedUrlCount} URL`); document.moveDown(.3).fontSize(9).fillColor("#3a3a3c").text(finding.summary); document.moveDown(.25).fillColor("#1558a2").text(`Öneri: ${finding.recommendation}`); document.fillColor("#16894d").text(`Doğrulama: ${finding.verification}`); }
    if (input.findings.length === 0) document.moveDown().fontSize(10).fillColor("#6e6e73").text("Açık bulgu bulunmuyor. Denetim kapsamı ve son çalışma durumu ayrıca kontrol edilmelidir.");
    document.end();
  });
}
function safeFilename(value: string): string { return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "report"; }
