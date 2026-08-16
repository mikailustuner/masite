# Security Policy

## Reporting

Do not open public issues for vulnerabilities. Send a private report to the security contact configured on the production bot-information page. Include reproduction steps, affected URL, expected impact, and whether any customer data was accessed.

## Crawler safety boundary

- Only HTTP and HTTPS are supported.
- Private, loopback, link-local, multicast, documentation, and cloud metadata networks are denied.
- Redirect targets are revalidated and connections are pinned to the validated address.
- Production permits only explicitly configured destination ports.
- Crawls are passive by default and do not attempt authentication, exploitation, brute force, or state-changing form submissions.

## Secrets

Never commit `.env`, provider credentials, session secrets, database passwords, HAR files, page HTML, or screenshots containing customer data. Production secrets must be delivered by a managed secret store.
