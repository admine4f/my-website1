// In-app legal & info documents (Privacy Policy, White Paper, Roadmap).
// Plain data + a tiny renderer. Edit the text here; no external links are used.

export type LegalKey = 'privacy' | 'whitepaper' | 'roadmap';

export type LegalBlock = { p: string } | { li: string[] };

export interface LegalSection {
  h: string;
  p?: string[];
  li?: string[];
  blocks?: LegalBlock[]; // when present, rendered in this exact order
}

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

const UPDATED = 'November 5, 2026';

export const LEGAL_DOCS: Record<LegalKey, LegalDoc> = {
  privacy: {
    title: 'Privacy Policy – E4F Web3 Exchange',
    updated: 'November 5, 2026',
    intro:
      'E4F Web3 Exchange ("E4F", "we", "our", or "us") is a Telegram Mini App (TMA) that currently operates as a trading simulation and mining game.',
    sections: [
      {
        h: '',
        blocks: [
          { p: 'This Privacy Policy explains what information we collect, how we use it, how advertising works, and what choices users have.' },
          { p: 'By using E4F, you acknowledge this Privacy Policy.' },
        ],
      },
      {
        h: '1. Information We Collect',
        blocks: [
          { p: 'We may collect and process the following information:' },
          { li: ['Telegram Data: Telegram user ID, name, username, and language, verified through Telegram\'s authentication system.', 'Referral Data: Referral codes used or shared by users.', 'In-App Activity: Mining sessions, activity streaks, spins, gift boxes, daily check-ins, tasks, and in-app balances.', 'Security Information: IP address, device type, timestamps, and technical request logs.', 'Advertising Data: Advertising session identifiers, ad network information, and ad completion status.'] },
          { p: 'We do not request Telegram passwords, identity documents, selfies, phone contacts, or precise GPS location.' },
        ],
      },
      {
        h: '1.1 Trusted Miner Activity System (No KYC)',
        blocks: [
          { p: 'E4F does not currently require identity documents, KYC verification, or deposits to use its game features.' },
          { p: 'The Trusted Miner badge is an in-app achievement for mining on 120 consecutive UTC days. If a user misses a day, the count restarts at Day 1 and a new 120-day period is needed. The badge is not KYC, not government or identity verification, and does not confirm a person\'s legal identity. E4F does not collect ID cards, passports or identity documents for it.' },
        ],
      },
      {
        h: '2. How We Use Information',
        blocks: [
          { p: 'We use collected information to:' },
          { li: ['Operate the E4F Mini App.', 'Maintain mining and activity streaks.', 'Manage referrals and rewards.', 'Prevent fraud, abuse, and automated activity.', 'Maintain security and improve performance.', 'Validate rewarded advertising sessions.', 'Fix technical issues and improve user experience.'] },
        ],
      },
      {
        h: '2.1 Token Status, Balances and Planned Issue',
        blocks: [
          { p: 'E4F is currently in a pre-listing development phase.' },
          { p: 'The E4F token is not currently listed on any exchange through this application.' },
          { p: 'Balances shown in the app are in-app balances recorded on our servers.' },
          { p: 'E4F is the native coin of the E4F project. After the mining program ends (Mining Season 1 is scheduled to run until 28 February 2028, as shown in the app), E4F balances earned in the app are planned to be issued 1:1 as native E4F on the TON blockchain, in line with Telegram rules. The exact date, claim method and conditions will be announced in the app.' },
          { p: 'Accounts found to break the rules or to use fraud, bots or fake accounts may be excluded from the issue.' },
          { p: 'The planned target listing date for E4F is 28 February 2028. This is the date E4F officially plans to work towards. It is not a confirmation from any exchange.' },
          { p: 'As of the date of this document, no exchange has approved or confirmed an E4F listing. An actual listing depends on exchange approval, technical readiness and applicable terms. We will not present any listing as confirmed without official confirmation.' },
          { p: 'Withdrawals are not available before E4F is listed. After a listing, withdrawals are planned to be enabled under published rules, including a minimum amount and review.' },
          { p: 'Not promised: any exchange listing, any market price or value, and any profit or income. These depend on market, exchange, legal and technical conditions.' },
        ],
      },
      {
        h: '3. Advertising and Rewarded Ads',
        blocks: [
          { p: 'E4F may display optional rewarded advertisements through third-party advertising partners.' },
          { p: 'Watching advertisements is voluntary.' },
        ],
      },
      {
        h: '3.1 Basic Features Without Ads',
        blocks: [
          { p: 'The following basic game features are designed to remain accessible without watching advertisements:' },
          { li: ['Starting a mining session (no advertisement is required to start mining).', 'Trading simulation.', 'Viewing the wallet.', 'Referrals.', 'Daily check-ins.', 'Tasks.', 'Viewing Trusted Miner status.'] },
        ],
      },
      {
        h: '3.2 Optional Advertisements for Bonus Rewards',
        blocks: [
          { p: 'Users may voluntarily watch advertisements to receive additional in-game rewards.' },
          { p: 'Advertisements may appear at these locations:' },
          { li: ['1. Spin Wheel Screen – "Extra Spin (Watch Ad)"', '2. Gift Box Screen – "Open Box (Watch Ad)"', '3. Daily Check-in Screen – "Claim Bonus (Watch Ad)"', '4. Mining Screen – "Bonus Reward (Watch Ad)"'] },
          { p: 'The app is designed so that:' },
          { li: ['Users are informed when an action requires watching a rewarded ad.', 'Ads are optional and are not required for basic game functionality.', 'Rewards are granted only after the rewarded ad is successfully completed and validated.', 'Rewarded ads pay only after they are completed and validated. Sponsor tasks pay only after the task requirement, such as a waiting time, is completed. Some partner offers may open a partner page outside Telegram.', 'Closing an advertisement before completion does not qualify for a reward.'] },
          { p: 'Actual ad availability may depend on the advertising provider.' },
        ],
      },
      {
        h: '3.3 Third-Party Advertising Partners',
        blocks: [
          { p: 'E4F works with third-party advertising partners. Each partner collects data under its own privacy policy. E4F does not control their data collection.' },
          { p: 'Third-party advertising networks may collect information such as device identifiers, advertising interaction data, and technical information according to their own privacy policies.' },
          { p: 'E4F may share advertising session information and relevant technical data with advertising partners to facilitate ad delivery, verification, fraud prevention, and monetization.' },
          { p: 'Users should review the privacy policies of the relevant advertising providers.' },
        ],
      },
      {
        h: '4. Information Sharing',
        blocks: [
          { p: 'We do not sell users\' personal information.' },
          { p: 'Information may be shared with:' },
          { li: ['Hosting and database service providers.', 'Advertising and monetization partners.', 'Security and fraud-prevention service providers.', 'Government authorities when required by applicable law.'] },
          { p: 'We share only information reasonably necessary for the relevant purpose.' },
        ],
      },
      {
        h: '5. Data Retention and Account Deletion',
        blocks: [
          { p: 'We retain information for as long as necessary to operate the service, maintain security, prevent fraud, and comply with applicable legal obligations.' },
          { p: 'Users may request account deletion through:' },
          { p: 'Profile → Delete Account' },
          { p: 'Where deletion is available, associated account information, balances, mining sessions, and game activity will be deleted or deactivated according to our deletion process.' },
          { p: 'Certain security or anti-fraud records may be retained for a limited period where reasonably necessary or legally required.' },
        ],
      },
      {
        h: '6. Security',
        blocks: [
          { p: 'We use reasonable technical and organizational measures to protect user information.' },
          { p: 'These measures include:' },
          { li: ['Cryptographic verification of Telegram authentication.', 'HTTPS connections.', 'Server-side reward validation.', 'Security monitoring and fraud-prevention measures.'] },
          { p: 'However, no online service can guarantee absolute security.' },
        ],
      },
      {
        h: '7. Age Requirements',
        blocks: [
          { p: 'E4F is intended for users who are at least 18 years old or have reached the age of majority in their jurisdiction, whichever is higher.' },
        ],
      },
      {
        h: '8. International Data Processing',
        blocks: [
          { p: 'User information may be processed or stored in countries other than the user\'s country of residence, depending on our hosting, database, and service providers.' },
          { p: 'Where applicable, we take reasonable steps to protect information during such processing.' },
        ],
      },
      {
        h: '9. User Choices and Rights',
        blocks: [
          { p: 'Depending on applicable law, users may have the right to:' },
          { li: ['Access certain account information.', 'Request correction of inaccurate information.', 'Request account deletion.', 'Choose whether to watch optional rewarded advertisements.', 'Stop using the application.'] },
          { p: 'Users may contact E4F through its official Telegram bot for privacy-related questions or requests.' },
        ],
      },
      {
        h: '10. Changes to This Privacy Policy',
        blocks: [
          { p: 'We may update this Privacy Policy when our services, features, advertising practices, or legal requirements change.' },
          { p: 'The latest update date will be displayed at the top of this document.' },
          { p: 'We do not currently ask users for a separate confirmation of policy updates.' },
        ],
      },
      {
        h: '11. Contact Information',
        blocks: [
          { p: 'For questions, privacy requests, or concerns regarding this Privacy Policy, contact us through the official E4F Web3 Exchange Telegram bot.' },
          { p: 'E4F Web3 Exchange' },
          { p: 'Telegram Mini App' },
          { p: 'Privacy Policy – November 5, 2026' },
        ],
      },
    ],
  },
  whitepaper: {
    title: 'White Paper',
    updated: UPDATED,
    intro:
      'E4F Web3 Exchange is a Telegram Mini App where users earn rewards by mining, completing tasks and watching optional rewarded ads. This paper describes how it works, how rewards are funded and what is not promised.',
    sections: [
      {
        h: '1. Abstract',
        p: [
          'E4F brings a simple mining and rewards experience to Telegram without ID cards, KYC or a deposit. Users mine daily, collect rewards, invite friends and build a balance inside the app. Rewards are funded by advertising revenue from rewarded ads that users choose to watch.',
        ],
      },
      {
        h: '2. Problem',
        p: [
          'Many reward apps are hard to join, ask for sensitive documents, or hand out rewards that anyone can forge. Users want an easy, fair app that works inside Telegram and rewards real participation.',
        ],
      },
      {
        h: '3. Product overview',
        li: [
          'Daily Mining: start a mining session and collect rewards when it finishes. No advertisement is required to start mining. An optional rewarded ad can give a bonus.',
          'Rewards Center: Spin Wheel and Gift Boxes, each limited per day (the day resets at 00:00 UTC).',
          'Daily Check-In: a 7-day streak of rewards.',
          'Tasks: simple tasks such as joining a channel or following a timer, reviewed and rewarded.',
          'Referrals: invite friends with a personal link; more active referrals raise your mining boost.',
          'Wallet: Spot USDT and E4F pre-list balances. Withdrawals are not available before E4F is listed.',
          'Trusted Miner: The Trusted Miner badge is an in-app achievement for mining on 120 consecutive UTC days. If a user misses a day, the count restarts at Day 1 and a new 120-day period is needed. The badge is not KYC, not government or identity verification, and does not confirm a person\'s legal identity. E4F does not collect ID cards, passports or identity documents for it.',
          'Live control: notices, tasks and settings are managed by the team from an admin panel and appear instantly, without an app update.',
        ],
      },
      {
        h: '4. How rewards are funded',
        p: [
          'Advertisers pay ad networks to show their ads. When a user watches a rewarded ad to the end, the network pays the app a share of that revenue, and the app passes value to users as rewards. Because of this, reward sizes, daily limits and withdrawal rules are set by the team and may change as ad revenue changes.',
        ],
      },
      {
        h: '5. Ad integrity',
        li: [
          'Rewarded ads play inside the Telegram Mini App. Some partner offers, such as sponsor tasks, may open a partner page outside Telegram.',
          'A reward is given only after the ad finishes. Closing early gives no reward and does not count.',
          'Rewarded ads pay only after the ad is completed. Sponsor tasks pay only after the task requirement, such as a waiting time, is completed.',
          'Every ad view is checked on the server. A view can be redeemed only once, and daily slots are counted on the server.',
          'Several ad networks are used in order. If one has no ad, the next one is tried.',
          'The app follows the rules of its ad partners, including a ban on fake traffic, bots and manipulated statistics.',
        ],
      },
      {
        h: '6. Security design',
        li: [
          'Telegram login data is verified with the Telegram bot token on the server.',
          'Rewards, balances and limits are decided by the server, not by the phone.',
          'Sensitive actions use short-lived signed tokens.',
          'The database is closed to public access and used only by the server.',
          'Admin tools are protected by a secret that is stored only in the server settings.',
          'Suspended accounts cannot start ad sessions or withdraw.',
        ],
      },
      {
        h: '7. The E4F token',
        p: [
          'E4F balances are currently pre-list balances. E4F is not yet listed on any exchange.',
          'E4F is the native coin of the E4F project. After the mining program ends (Mining Season 1 is scheduled to run until 28 February 2028, as shown in the app), E4F balances earned in the app are planned to be issued 1:1 as native E4F on the TON blockchain, in line with Telegram rules. The exact date, claim method and conditions will be announced in the app.',
          'Accounts found to break the rules or to use fraud, bots or fake accounts may be excluded from the issue.',
          'The planned target listing date for E4F is 28 February 2028. This is the date E4F officially plans to work towards. It is not a confirmation from any exchange.',
          'As of the date of this document, no exchange has approved or confirmed an E4F listing. An actual listing depends on exchange approval, technical readiness and applicable terms. We will not present any listing as confirmed without official confirmation.',
          'Withdrawals are not available before E4F is listed. After a listing, withdrawals are planned to be enabled under published rules, including a minimum amount and review.',
          'Not promised: any exchange listing, any market price or value, and any profit or income. These depend on market, exchange, legal and technical conditions.',
        ],
      },
      {
        h: '8. Risks and disclaimers',
        li: [
          'This is not financial advice or an investment offer. Do not spend money you cannot afford to lose.',
          'Ad revenue can change, so rewards and limits can change.',
          'Once withdrawals open after a listing, they may be reviewed and can be refused for fraud or rule violations.',
          'Crypto assets are volatile and the rules differ by country. You are responsible for following the laws where you live.',
          'Cybersecurity problems and technical failures can interrupt the service or cause data loss.',
          'Even if a listing happens, liquidity and a market price are not guaranteed.',
          'Laws, exchange rules and Telegram or TON rules can change and may affect the token issue and any listing.',
        ],
      },
      {
        h: '9. Conclusion',
        p: [
          'E4F aims to be a simple, secure and honest rewards app inside Telegram. It grows through real users, real ad revenue and clear rules.',
        ],
      },
    ],
  },

  roadmap: {
    title: 'Roadmap',
    updated: UPDATED,
    intro:
      'This roadmap shows where E4F is and where it is going. It is a plan, not a promise. Items and order can change.',
    sections: [
      {
        h: 'Phase 1: Foundation (Live)',
        li: [
          'Daily mining (rewarded ads are optional bonuses)',
          'Spin Wheel and Gift Boxes with daily limits',
          'Daily check-in, tasks and referrals',
          'Wallet (withdrawals open after E4F is listed)',
          'Admin panel for notices, tasks and settings',
          'Server-verified rewards and ad checks',
          'Trusted Miner badge (120 consecutive mining days; not KYC or identity verification)',
        ],
      },
      {
        h: 'Phase 2: Quality and ad reliability (In progress)',
        li: [
          'Better ad fill across partner networks and clearer messages when no ad is available',
          'Adding more advertising partners, always under their rules',
          'Profile settings, in-app policy and information pages',
          'More tests and monitoring for fraud and errors',
        ],
      },
      {
        h: 'Phase 3: Growth (Planned)',
        li: [
          'More tasks and partner campaigns',
          'Improved referral rewards and leaderboards',
          'Telegram notifications for mining and rewards',
          'More app languages',
        ],
      },
      {
        h: 'Phase 4: Wallet expansion (Planned)',
        li: [
          'Deposits and withdrawal networks (after listing)',
          'Clearer transaction history and receipts',
          'Extra account security options',
        ],
      },
      {
        h: 'Phase 5: E4F token issue and listing (Planned / Targeted)',
        li: [
          'Internal preparation (Planned): legal and technical preparation for the token issue and a possible listing.',
          'Token issue (Planned): E4F is the native coin of the E4F project. After the mining program ends (Mining Season 1 is scheduled to run until 28 February 2028, as shown in the app), E4F balances earned in the app are planned to be issued 1:1 as native E4F on the TON blockchain, in line with Telegram rules. The exact date, claim method and conditions will be announced in the app.',
          'Exchange applications (Conditional): applications are made only when E4F is ready. No application has been approved.',
          'Exchange approval (Conditional): As of the date of this document, no exchange has approved or confirmed an E4F listing. An actual listing depends on exchange approval, technical readiness and applicable terms. We will not present any listing as confirmed without official confirmation.',
          'Listing (Targeted): The planned target listing date for E4F is 28 February 2028. This is the date E4F officially plans to work towards. It is not a confirmation from any exchange.',
          'Deposits and withdrawals: Withdrawals are not available before E4F is listed. After a listing, withdrawals are planned to be enabled under published rules, including a minimum amount and review.',
          'Not promised: any exchange listing, any market price or value, and any profit or income. These depend on market, exchange, legal and technical conditions.',
        ],
      },
    ],
  },
};

export const LEGAL_ORDER: LegalKey[] = ['privacy', 'whitepaper', 'roadmap'];
