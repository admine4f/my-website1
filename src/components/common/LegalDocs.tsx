// In-app legal & info documents (Privacy Policy, White Paper, Roadmap).
// Plain data + a tiny renderer. Edit the text here; no external links are used.

export type LegalKey = 'privacy' | 'whitepaper' | 'roadmap';

export interface LegalSection {
  h: string;
  p?: string[];
  li?: string[];
}

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

const UPDATED = 'October 27, 2026';

export const LEGAL_DOCS: Record<LegalKey, LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    updated: UPDATED,
    intro:
      'E4F Web3 Exchange ("E4F", "we") is a Telegram Mini App. This policy explains what information we handle, why, and the choices you have. By using the app you agree to this policy.',
    sections: [
      {
        h: '1. Information we handle',
        li: [
          'Telegram account data provided by Telegram when you open the app: Telegram user ID, first and last name, username and language. We verify this data on our server before trusting it.',
          'Referral data: the referral code you used or share, and who joined through it.',
          'In-app activity: mining sessions, spins, gift boxes, daily check-ins, completed tasks, balances and transaction history.',
          'Wallet details you choose to enter: withdrawal or deposit addresses and transaction hashes.',
          'Security and anti-fraud data: IP address, device and browser type, timestamps and request logs.',
          'Ad records: an anonymous ad-session ID, which ad network showed the ad and whether the ad was completed.',
        ],
        p: [
          'We do not ask for passwords, ID documents, selfies, phone contacts or your precise location. No KYC is required for normal use.',
        ],
      },
      {
        h: '2. How we use it',
        li: [
          'To run the app: mining, rewards, tasks, referrals, wallet and withdrawals.',
          'To prevent fraud, bots, duplicate rewards and abuse.',
          'To keep the service secure, fix problems and improve it.',
          'To answer support requests and meet legal obligations.',
        ],
      },
      {
        h: '3. Advertising',
        p: [
          'Rewards in E4F are funded by advertising. Ads are shown inside the app by third-party advertising partners, and we may add or change partners over time.',
          'Watching an ad is always your choice. You are rewarded only after an ad finishes, never for clicking on an ad. If you close an ad early you receive no reward and it does not count.',
          'Ad networks may collect device and ad-interaction data under their own privacy policies. We pass them only an anonymous ad-session identifier; we do not give them your balance, wallet address or Telegram username.',
        ],
      },
      {
        h: '4. Sharing',
        p: [
          'We do not sell your personal data. We share data only with service providers that host and store it (for example our database and hosting providers), with ad networks as described above, and with authorities when the law requires it.',
        ],
      },
      {
        h: '5. Retention and deletion',
        p: [
          'We keep your data while your account is active. You can delete your account at any time from Profile > Delete Account. This permanently erases your balances, mining sessions and task records. Limited records may be kept where needed to prevent fraud or to comply with the law.',
        ],
      },
      {
        h: '6. Security',
        p: [
          'Telegram login data is cryptographically verified on the server, connections use HTTPS, database access is restricted to our server, and rewards are validated on the server. No online service is perfectly secure, so please keep your Telegram account safe.',
        ],
      },
      {
        h: '7. Age',
        p: [
          'E4F is intended for users aged 18 or over, or the age of majority where you live. Do not use the app if you are younger.',
        ],
      },
      {
        h: '8. International use',
        p: [
          'Our providers may store or process data in other countries. By using the app you accept this.',
        ],
      },
      {
        h: '9. Your choices',
        li: [
          'View and update your username in Profile.',
          'Delete your account and data in Profile.',
          'Choose whether to watch rewarded ads at all.',
          'Contact us through the official E4F bot in Telegram to ask about your data.',
        ],
      },
      {
        h: '10. Changes',
        p: [
          'We may update this policy. The date at the top shows the latest version. Continued use after a change means you accept it.',
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
          'Daily Mining: start a mining session and collect rewards when it finishes. A rewarded ad is watched to start a session.',
          'Rewards Center: Spin Wheel and Gift Boxes, each limited per day (the day resets at 00:00 UTC).',
          'Daily Check-In: a 7-day streak of rewards.',
          'Tasks: simple tasks such as joining a channel or following a timer, reviewed and rewarded.',
          'Referrals: invite friends with a personal link; more active referrals raise your mining boost.',
          'Wallet: Spot USDT and E4F pre-list balances, with withdrawals under the rules shown in the app.',
          'Trusted Miner: mine every day for 120 days in a row to earn a verified badge. No ID is required.',
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
          'Ads play inside the Telegram Mini App. There is no redirect to another site.',
          'A reward is given only after the ad finishes. Closing early gives no reward and does not count.',
          'Users are never paid for clicking ads.',
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
          'E4F balances are currently pre-list balances. E4F is not yet listed on any exchange. A listing, a price or any future value is not guaranteed and depends on market, legal and technical conditions.',
        ],
      },
      {
        h: '8. Risks and disclaimers',
        li: [
          'This is not financial advice or an investment offer. Do not spend money you cannot afford to lose.',
          'Ad revenue can change, so rewards and limits can change.',
          'Withdrawals may be reviewed and can be refused for fraud or rule violations.',
          'Crypto assets are volatile and the rules differ by country. You are responsible for following the laws where you live.',
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
          'Daily mining with rewarded ads',
          'Spin Wheel and Gift Boxes with daily limits',
          'Daily check-in, tasks and referrals',
          'Wallet and withdrawals',
          'Admin panel for notices, tasks and settings',
          'Server-verified rewards and ad checks',
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
          'Deposits and more withdrawal networks',
          'Clearer transaction history and receipts',
          'Extra account security options',
        ],
      },
      {
        h: 'Phase 5: E4F listing readiness (Planned, not guaranteed)',
        li: [
          'Legal and technical preparation for a possible E4F listing',
          'The current internal target is 2028. It depends on market, legal and technical conditions and may move or not happen.',
        ],
      },
    ],
  },
};

export const LEGAL_ORDER: LegalKey[] = ['privacy', 'whitepaper', 'roadmap'];
