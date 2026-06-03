import type { LegalSection } from '@/components/legal/LegalLayout'

export interface LegalDoc {
  slug:     string
  title:    string
  updated:  string
  intro:    string
  sections: LegalSection[]
}

const UPDATED = 'January 1, 2026'

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  'privacy-policy': {
    slug: 'privacy-policy', title: 'Privacy Policy', updated: UPDATED,
    intro: 'MediaDL ("we", "us") respects your privacy. This policy explains what information we collect, how we use it, and the choices you have. By using MediaDL you agree to the practices described here.',
    sections: [
      { heading: 'Information We Collect', body: ['We do not require an account to use the core download service. We do not store the URLs you submit, the content you download, or your downloaded files beyond the temporary processing window required to complete your request.', 'We may collect anonymous, aggregated usage analytics (page views, feature usage) via Google Analytics to improve the service. These analytics do not personally identify you.'] },
      { heading: 'How We Use Information', body: ['Any information collected is used solely to operate, maintain, secure, and improve MediaDL. We never sell your personal data to third parties.'] },
      { heading: 'Cookies', body: ['We use essential cookies for site functionality and optional analytics cookies. See our Cookie Policy for details and how to opt out.'] },
      { heading: 'Data Retention', body: ['Downloaded files are stored temporarily on our servers only for as long as needed to deliver them to you, then automatically deleted. We do not maintain a permanent archive of downloaded media.'] },
      { heading: 'Third-Party Services', body: ['We use Google Analytics, Google reCAPTCHA, and may display advertising via Google AdSense. These services have their own privacy policies governing the data they collect.'] },
      { heading: 'Your Rights', body: ['Depending on your jurisdiction (EU/UK GDPR, California CCPA), you have rights to access, correct, or delete your personal data. Contact us to exercise these rights.'] },
      { heading: 'Children\'s Privacy', body: ['MediaDL is not directed to children under 13 (or 16 in the EU). We do not knowingly collect data from children.'] },
      { heading: 'Changes & Contact', body: ['We may update this policy. Material changes will be posted here with a revised date. Questions? Email privacy@mediadl.app.'] },
    ],
  },
  'terms-of-service': {
    slug: 'terms-of-service', title: 'Terms of Service', updated: UPDATED,
    intro: 'These Terms govern your use of MediaDL. By accessing or using the service, you agree to be bound by these Terms. If you do not agree, do not use MediaDL.',
    sections: [
      { heading: 'Acceptance of Terms', body: ['By using MediaDL you represent that you are at least the age of majority in your jurisdiction and that you have the legal capacity to enter into these Terms.'] },
      { heading: 'Permitted Use', body: ['MediaDL is a technical tool that retrieves publicly accessible media. You agree to use it only for content you have the legal right to download — your own content, content with appropriate licenses, or content where downloading is permitted by the source and applicable law.'] },
      { heading: 'Prohibited Use', body: ['You may not use MediaDL to infringe copyright, violate the terms of service of third-party platforms, distribute downloaded content unlawfully, or for any illegal purpose. You are solely responsible for how you use downloaded content.'] },
      { heading: 'Intellectual Property', body: ['MediaDL does not claim ownership of any content you download. All downloaded content remains the property of its respective rights holders. MediaDL\'s own branding, code, and design are protected.'] },
      { heading: 'No Warranty', body: ['MediaDL is provided "as is" without warranties of any kind. We do not guarantee that every URL or platform will be supported, or that the service will be uninterrupted or error-free.'] },
      { heading: 'Limitation of Liability', body: ['To the maximum extent permitted by law, MediaDL is not liable for any indirect, incidental, or consequential damages arising from your use of the service or downloaded content.'] },
      { heading: 'Indemnification', body: ['You agree to indemnify and hold MediaDL harmless from any claims arising out of your misuse of the service or violation of these Terms or third-party rights.'] },
      { heading: 'Termination', body: ['We reserve the right to restrict or terminate access to MediaDL for any user who violates these Terms.'] },
      { heading: 'Governing Law', body: ['These Terms are governed by applicable law. Any disputes will be resolved in the appropriate courts of competent jurisdiction.'] },
    ],
  },
  'cookie-policy': {
    slug: 'cookie-policy', title: 'Cookie Policy', updated: UPDATED,
    intro: 'This Cookie Policy explains how MediaDL uses cookies and similar technologies when you visit our website.',
    sections: [
      { heading: 'What Are Cookies', body: ['Cookies are small text files stored on your device that help websites function and remember your preferences.'] },
      { heading: 'Types We Use', body: ['Essential cookies: required for the site to function (e.g. your theme preference). Analytics cookies: help us understand usage via Google Analytics. Advertising cookies: may be set by Google AdSense if ads are shown.'] },
      { heading: 'Managing Cookies', body: ['You can control or delete cookies through your browser settings. Disabling essential cookies may impair site functionality.'] },
      { heading: 'Third-Party Cookies', body: ['Some cookies are set by third parties (Google Analytics, AdSense, reCAPTCHA, Tawk.to chat). These are governed by the respective providers\' policies.'] },
      { heading: 'Updates', body: ['We may update this Cookie Policy from time to time. Continued use of the site constitutes acceptance of any changes.'] },
    ],
  },
  'dmca': {
    slug: 'dmca', title: 'DMCA & Copyright Policy', updated: UPDATED,
    intro: 'MediaDL respects the intellectual property rights of others and complies with the Digital Millennium Copyright Act (DMCA). MediaDL is a neutral technical tool and does not host, store, or distribute copyrighted content.',
    sections: [
      { heading: 'Our Role', body: ['MediaDL functions like a browser — it retrieves publicly available media at the user\'s direction. We do not maintain a library of content and do not control what users choose to download.'] },
      { heading: 'Filing a Takedown Notice', body: ['If you believe content accessible through our tool infringes your copyright, send a notice to dmca@mediadl.app including: identification of the copyrighted work, the infringing material, your contact information, a good-faith statement, and your physical or electronic signature.'] },
      { heading: 'Counter-Notification', body: ['If you believe your content was wrongly removed, you may submit a counter-notification with the required statutory information.'] },
      { heading: 'Repeat Infringers', body: ['We will restrict access for users who repeatedly misuse the service to infringe copyright.'] },
      { heading: 'Disclaimer', body: ['Users are solely responsible for ensuring they have the right to download any content. MediaDL does not endorse copyright infringement.'] },
    ],
  },
  'refund-policy': {
    slug: 'refund-policy', title: 'Refund Policy', updated: UPDATED,
    intro: 'MediaDL\'s core service is free. This policy applies to any optional premium plans we may offer.',
    sections: [
      { heading: 'Free Service', body: ['The core MediaDL download service is free of charge and requires no payment.'] },
      { heading: 'Premium Subscriptions', body: ['If you purchase a premium plan, you may request a refund within 7 days of purchase if you are unsatisfied, provided the service was not substantially used.'] },
      { heading: 'How to Request', body: ['Email billing@mediadl.app with your order details. Approved refunds are processed to the original payment method within 5–10 business days.'] },
      { heading: 'Non-Refundable Cases', body: ['Refunds are not available after the 7-day window or for accounts terminated due to Terms violations.'] },
    ],
  },
  'gdpr': {
    slug: 'gdpr', title: 'GDPR Compliance', updated: UPDATED,
    intro: 'For users in the European Union and United Kingdom, MediaDL complies with the General Data Protection Regulation (GDPR).',
    sections: [
      { heading: 'Lawful Basis', body: ['We process minimal data on the basis of legitimate interest (operating and securing the service) and consent (optional analytics and advertising cookies).'] },
      { heading: 'Your Rights Under GDPR', body: ['You have the right to access, rectify, erase, restrict, and port your personal data, and to object to processing. You may also withdraw consent at any time.'] },
      { heading: 'Data Minimization', body: ['We collect only what is necessary. We do not store your submitted URLs or downloaded content beyond temporary processing.'] },
      { heading: 'International Transfers', body: ['Where data is transferred outside the EEA, we rely on appropriate safeguards such as Standard Contractual Clauses.'] },
      { heading: 'Exercising Rights', body: ['To exercise any GDPR right, email gdpr@mediadl.app. We respond within 30 days.'] },
    ],
  },
  'ccpa': {
    slug: 'ccpa', title: 'CCPA Notice (California)', updated: UPDATED,
    intro: 'This notice applies to California residents under the California Consumer Privacy Act (CCPA/CPRA).',
    sections: [
      { heading: 'Information We Collect', body: ['As described in our Privacy Policy, we collect minimal anonymous analytics data. We do not sell personal information.'] },
      { heading: 'Your California Rights', body: ['You have the right to know what personal information is collected, to request deletion, to opt out of any sale (we do not sell data), and to non-discrimination for exercising your rights.'] },
      { heading: 'Do Not Sell', body: ['MediaDL does not sell personal information as defined by the CCPA.'] },
      { heading: 'Submitting Requests', body: ['California residents may submit requests to privacy@mediadl.app. We verify identity before fulfilling requests.'] },
    ],
  },
  'acceptable-use': {
    slug: 'acceptable-use', title: 'Acceptable Use Policy', updated: UPDATED,
    intro: 'This Acceptable Use Policy defines prohibited uses of MediaDL to keep the service safe and lawful for everyone.',
    sections: [
      { heading: 'Permitted Activities', body: ['Downloading your own content, content you are licensed to use, public-domain works, and content where downloading is permitted by the platform and law.'] },
      { heading: 'Prohibited Activities', body: ['Copyright infringement, downloading content to redistribute commercially without rights, circumventing paywalls or DRM unlawfully, automated abuse or scraping that overloads our infrastructure, and any illegal activity.'] },
      { heading: 'Rate Limits', body: ['To ensure fair access, we enforce reasonable rate limits. Attempting to bypass these limits is prohibited.'] },
      { heading: 'Enforcement', body: ['Violations may result in temporary or permanent restriction of access. Serious violations may be reported to authorities.'] },
    ],
  },
  'disclaimer': {
    slug: 'disclaimer', title: 'Disclaimer', updated: UPDATED,
    intro: 'Please read this disclaimer carefully before using MediaDL.',
    sections: [
      { heading: 'General Information', body: ['MediaDL is provided for general informational and personal use. We make no guarantees about the accuracy, reliability, or availability of the service.'] },
      { heading: 'User Responsibility', body: ['You are solely responsible for ensuring that your use of MediaDL and any content you download complies with applicable laws and third-party terms.'] },
      { heading: 'No Affiliation', body: ['MediaDL is not affiliated with, endorsed by, or sponsored by YouTube, Instagram, TikTok, Twitter, Meta, or any other platform mentioned. All trademarks belong to their respective owners.'] },
      { heading: 'External Links', body: ['Our site may contain links to external sites. We are not responsible for their content or practices.'] },
    ],
  },
  'accessibility': {
    slug: 'accessibility', title: 'Accessibility Statement', updated: UPDATED,
    intro: 'MediaDL is committed to ensuring digital accessibility for people of all abilities.',
    sections: [
      { heading: 'Our Commitment', body: ['We aim to conform to WCAG 2.1 Level AA standards and continually improve the accessibility of our website.'] },
      { heading: 'Measures Taken', body: ['Semantic HTML, keyboard navigation support, sufficient color contrast, focus indicators, descriptive labels, and responsive design across devices.'] },
      { heading: 'Feedback', body: ['If you encounter accessibility barriers, please email accessibility@mediadl.app so we can address them promptly.'] },
    ],
  },
  'eula': {
    slug: 'eula', title: 'End User License Agreement', updated: UPDATED,
    intro: 'This EULA governs your license to use the MediaDL software and service.',
    sections: [
      { heading: 'License Grant', body: ['We grant you a personal, non-exclusive, non-transferable, revocable license to use MediaDL for lawful purposes in accordance with these terms.'] },
      { heading: 'Restrictions', body: ['You may not reverse-engineer, resell, sublicense, or create derivative commercial products from MediaDL without written permission.'] },
      { heading: 'Ownership', body: ['MediaDL and all associated intellectual property remain our exclusive property. This license does not transfer any ownership rights.'] },
      { heading: 'Termination', body: ['This license terminates automatically if you breach any term. Upon termination you must cease all use of the service.'] },
    ],
  },
  'data-processing': {
    slug: 'data-processing', title: 'Data Processing Agreement', updated: UPDATED,
    intro: 'This Data Processing Agreement (DPA) describes how MediaDL processes data on behalf of users where applicable.',
    sections: [
      { heading: 'Scope', body: ['This DPA applies where MediaDL acts as a data processor. Given our minimal data model, processing is limited to the temporary handling required to deliver downloads.'] },
      { heading: 'Processing Details', body: ['Nature: media retrieval and delivery. Duration: only for the active request. Data types: submitted URLs (not stored) and downloaded files (auto-deleted).'] },
      { heading: 'Sub-processors', body: ['We use infrastructure and analytics sub-processors (e.g. hosting providers, Google Analytics) bound by appropriate data protection obligations.'] },
      { heading: 'Security', body: ['We implement technical and organizational measures including encryption in transit, access controls, and automatic data deletion.'] },
    ],
  },
  'community-guidelines': {
    slug: 'community-guidelines', title: 'Community Guidelines', updated: UPDATED,
    intro: 'These guidelines help keep MediaDL a respectful and lawful environment for all users.',
    sections: [
      { heading: 'Respect Copyright', body: ['Only download content you have the right to use. Respect creators and rights holders.'] },
      { heading: 'No Abuse', body: ['Do not attempt to overload, attack, or exploit the service. Automated mass scraping that harms our infrastructure is prohibited.'] },
      { heading: 'Lawful Use Only', body: ['Do not use MediaDL for any illegal purpose or to download content that is illegal in your jurisdiction.'] },
      { heading: 'Reporting', body: ['Report misuse or security issues to abuse@mediadl.app.'] },
    ],
  },
  'security-policy': {
    slug: 'security-policy', title: 'Security Policy', updated: UPDATED,
    intro: 'MediaDL takes security seriously. This policy outlines our practices and how to report vulnerabilities.',
    sections: [
      { heading: 'Our Practices', body: ['We use HTTPS encryption, security headers (HSTS, CSP), rate limiting, input validation, and automatic cleanup of temporary files. Our infrastructure is regularly updated.'] },
      { heading: 'Responsible Disclosure', body: ['If you discover a security vulnerability, please report it privately to security@mediadl.app before public disclosure. We aim to acknowledge reports within 48 hours.'] },
      { heading: 'Scope', body: ['Our security commitment covers the MediaDL website and API. Third-party platforms are outside our control.'] },
      { heading: 'No Bounty Guarantee', body: ['While we appreciate disclosures, we do not currently operate a paid bug bounty program. Responsible researchers will be credited where appropriate.'] },
    ],
  },
}

export const LEGAL_SLUGS = Object.keys(LEGAL_DOCS)
