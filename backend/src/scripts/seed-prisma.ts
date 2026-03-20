/**
 * Prisma Seed Script — 10 markets per category
 * Usage: npx ts-node src/scripts/seed-prisma.ts
 */

import { PrismaClient, MarketCategory } from '@prisma/client';

const prisma = new PrismaClient();

const YES = { name: 'Yes', color: '#22C55E' };
const NO  = { name: 'No',  color: '#EF4444' };

const PALETTE = ['#3B82F6','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316','#22C55E','#EF4444'];

function mc(names: string[]): { name: string; color: string }[] {
  return names.map((name, i) => ({ name, color: PALETTE[i % PALETTE.length] }));
}

interface MarketSeed {
  title: string;
  description: string;
  category: MarketCategory;
  expiresAt: Date;
  outcomes: { name: string; color: string }[];
}

const MARKETS: MarketSeed[] = [
  // ─── POLITICS (10) ────────────────────────────────────────────────────────────
  {
    title: 'Will Trump be impeached in his second term?',
    description: 'A formal impeachment vote passes in the US House of Representatives against Donald Trump during his second presidential term.',
    category: 'POLITICS', expiresAt: new Date('2028-01-20'),
    outcomes: [YES, NO],
  },
  {
    title: 'Which party controls the House after 2026 Midterms?',
    description: 'Which party holds the majority in the US House of Representatives after the November 2026 midterm elections.',
    category: 'POLITICS', expiresAt: new Date('2026-11-30'),
    outcomes: mc(['Democrats', 'Republicans', 'Split/Tied']),
  },
  {
    title: 'Will there be a lasting ceasefire in Ukraine by end of 2025?',
    description: 'A formal ceasefire agreement between Russia and Ukraine is signed and holds for at least 30 days before December 31, 2025.',
    category: 'POLITICS', expiresAt: new Date('2025-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will China take military action against Taiwan by 2028?',
    description: 'Chinese military forces conduct an invasion, blockade, or significant armed assault on Taiwan before January 2028.',
    category: 'POLITICS', expiresAt: new Date('2028-01-01'),
    outcomes: [YES, NO],
  },
  {
    title: 'Who wins the next UK General Election?',
    description: 'Which party forms the next UK government after the next general election.',
    category: 'POLITICS', expiresAt: new Date('2029-12-31'),
    outcomes: mc(['Labour', 'Conservative', 'Reform UK', 'Other']),
  },
  {
    title: 'Will Iran develop a functional nuclear weapon by 2027?',
    description: 'Iran successfully tests or deploys a nuclear weapon before December 2027.',
    category: 'POLITICS', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will North Korea conduct a nuclear test in 2025?',
    description: 'North Korea carries out an underground nuclear weapons test in calendar year 2025.',
    category: 'POLITICS', expiresAt: new Date('2025-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will the EU expand to 30+ member states by 2030?',
    description: 'The European Union officially admits enough new members to reach 30 or more member states before 2030.',
    category: 'POLITICS', expiresAt: new Date('2030-01-01'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will there be a US-China military confrontation in 2026?',
    description: 'Direct military engagement between US and Chinese forces, including naval or aerial incidents resulting in casualties.',
    category: 'POLITICS', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Who wins the 2027 French Presidential Election?',
    description: 'Who becomes the next President of France in the 2027 election.',
    category: 'POLITICS', expiresAt: new Date('2027-06-30'),
    outcomes: mc(['Marine Le Pen', 'Centre-Left candidate', 'Centre-Right candidate', 'Other']),
  },

  // ─── SPORTS (10) ──────────────────────────────────────────────────────────────
  {
    title: 'Who wins the 2026 FIFA World Cup?',
    description: 'Which nation lifts the FIFA World Cup trophy at the 2026 tournament hosted in USA, Canada, and Mexico.',
    category: 'SPORTS', expiresAt: new Date('2026-07-20'),
    outcomes: mc(['Brazil', 'France', 'Argentina', 'Germany', 'Spain', 'England']),
  },
  {
    title: 'Who wins the 2026 NBA Championship?',
    description: 'Which team wins the 2026 NBA Finals.',
    category: 'SPORTS', expiresAt: new Date('2026-06-30'),
    outcomes: mc(['Boston Celtics', 'LA Lakers', 'Golden State Warriors', 'New York Knicks']),
  },
  {
    title: 'Who wins Wimbledon Men\'s Singles 2026?',
    description: 'Which player wins the Wimbledon Men\'s Singles title in 2026.',
    category: 'SPORTS', expiresAt: new Date('2026-07-15'),
    outcomes: mc(['Carlos Alcaraz', 'Jannik Sinner', 'Novak Djokovic', 'Other']),
  },
  {
    title: 'Who wins the 2026 Formula 1 World Championship?',
    description: 'Which driver wins the Drivers\' Championship in the 2026 F1 season (new regulations year).',
    category: 'SPORTS', expiresAt: new Date('2026-12-01'),
    outcomes: mc(['Max Verstappen', 'Lando Norris', 'Charles Leclerc', 'Lewis Hamilton', 'Other']),
  },
  {
    title: 'Will Lionel Messi retire before the 2026 World Cup?',
    description: 'Lionel Messi officially announces his retirement from professional football before the 2026 FIFA World Cup begins.',
    category: 'SPORTS', expiresAt: new Date('2026-06-11'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will the USA reach the semifinals of the 2026 World Cup?',
    description: 'The United States Men\'s National Team reaches the semi-finals in the 2026 FIFA World Cup on home soil.',
    category: 'SPORTS', expiresAt: new Date('2026-07-10'),
    outcomes: [YES, NO],
  },
  {
    title: 'Who wins Super Bowl LX (February 2026)?',
    description: 'Which team wins Super Bowl LX in February 2026.',
    category: 'SPORTS', expiresAt: new Date('2026-02-10'),
    outcomes: mc(['Kansas City Chiefs', 'Philadelphia Eagles', 'San Francisco 49ers', 'Dallas Cowboys']),
  },
  {
    title: 'Who wins The Masters 2026?',
    description: 'Which golfer wins the Masters Tournament at Augusta National in April 2026.',
    category: 'SPORTS', expiresAt: new Date('2026-04-15'),
    outcomes: mc(['Scottie Scheffler', 'Rory McIlroy', 'Bryson DeChambeau', 'Other']),
  },
  {
    title: 'Will Liverpool win the Premier League 2025-26?',
    description: 'Liverpool FC wins the English Premier League title in the 2025-26 season.',
    category: 'SPORTS', expiresAt: new Date('2026-05-25'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will LeBron James play in the 2026-27 NBA season?',
    description: 'LeBron James is an active NBA player and appears in at least one regular season game in the 2026-27 season.',
    category: 'SPORTS', expiresAt: new Date('2026-10-31'),
    outcomes: [YES, NO],
  },

  // ─── CRYPTO (10) ──────────────────────────────────────────────────────────────
  {
    title: 'Will Bitcoin exceed $150k by end of 2026?',
    description: 'Bitcoin (BTC) trades above $150,000 USD on any major exchange at any point before December 31, 2026.',
    category: 'CRYPTO', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Ethereum reach $10,000 by end of 2026?',
    description: 'Ethereum (ETH) trades above $10,000 USD on any major exchange before December 31, 2026.',
    category: 'CRYPTO', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Bitcoin reach $200,000 by end of 2027?',
    description: 'Bitcoin (BTC) trades above $200,000 USD on any major exchange at any point before December 31, 2027.',
    category: 'CRYPTO', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Solana flip Ethereum in market cap?',
    description: 'Solana\'s (SOL) total market capitalization exceeds Ethereum\'s (ETH) market cap for at least 7 consecutive days.',
    category: 'CRYPTO', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Dogecoin reach $1.00?',
    description: 'Dogecoin (DOGE) trades at or above $1.00 USD on any major exchange.',
    category: 'CRYPTO', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Which crypto will have the best returns in 2026?',
    description: 'Which cryptocurrency delivers the highest percentage return from Jan 1 to Dec 31, 2026.',
    category: 'CRYPTO', expiresAt: new Date('2027-01-05'),
    outcomes: mc(['Bitcoin (BTC)', 'Ethereum (ETH)', 'Solana (SOL)', 'XRP', 'Other altcoin']),
  },
  {
    title: 'Will the US Federal Reserve launch a digital dollar (CBDC)?',
    description: 'The US Federal Reserve officially launches a Central Bank Digital Currency (CBDC) available to the public.',
    category: 'CRYPTO', expiresAt: new Date('2028-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will there be a major crypto exchange collapse in 2026?',
    description: 'A top-10 cryptocurrency exchange by volume ceases operations, declares bankruptcy, or halts withdrawals in 2026.',
    category: 'CRYPTO', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Bitcoin spot ETFs reach $200B total AUM?',
    description: 'The combined Assets Under Management of all US-listed Bitcoin spot ETFs reaches $200 billion USD.',
    category: 'CRYPTO', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will XRP win its SEC lawsuit definitively?',
    description: 'A final court ruling or settlement definitively rules that XRP is not a security under US law.',
    category: 'CRYPTO', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },

  // ─── ENTERTAINMENT (10) ───────────────────────────────────────────────────────
  {
    title: 'Will GTA 6 release before December 2025?',
    description: 'Grand Theft Auto VI officially launches and is available to purchase before December 31, 2025.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2025-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Which film wins Best Picture at the Oscars 2026?',
    description: 'Which film wins the Academy Award for Best Picture at the 2026 (98th) Oscars ceremony.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2026-03-30'),
    outcomes: mc(['A24 film', 'Netflix film', 'Disney/Marvel film', 'Other studio film']),
  },
  {
    title: 'Will Taylor Swift release a new studio album in 2026?',
    description: 'Taylor Swift releases a completely new studio album (not a re-recording) in calendar year 2026.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Who wins Grammy Album of the Year 2026?',
    description: 'Which artist wins the Grammy Award for Album of the Year at the 2026 Grammy Awards.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2026-02-28'),
    outcomes: mc(['Taylor Swift', 'Beyoncé', 'Kendrick Lamar', 'Sabrina Carpenter', 'Other']),
  },
  {
    title: 'Will TikTok remain available in the US through 2026?',
    description: 'TikTok remains downloadable and usable in the United States without a VPN through December 31, 2026.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Netflix surpass 300 million subscribers?',
    description: 'Netflix reports 300 million or more paid subscribers in any quarterly earnings report.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Avengers: Doomsday cross $2B at the box office?',
    description: 'Marvel\'s Avengers: Doomsday earns $2 billion or more in total worldwide box office gross.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will AI-generated music win a major award by 2028?',
    description: 'A song primarily composed or performed by an AI system wins a Grammy, Billboard Music Award, or equivalent major music award.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2028-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Elon Musk buy another major media company?',
    description: 'Elon Musk acquires a controlling stake in a major media company (TV network, newspaper, streaming service) beyond X/Twitter.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Which streaming service will be #1 in subscribers by end of 2026?',
    description: 'Which streaming platform has the most paid subscribers globally at the end of 2026.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2027-01-31'),
    outcomes: mc(['Netflix', 'Disney+/Hulu', 'Amazon Prime Video', 'YouTube Premium', 'Other']),
  },

  // ─── SCIENCE (10) ─────────────────────────────────────────────────────────────
  {
    title: 'Will SpaceX successfully land humans on Mars by 2030?',
    description: 'SpaceX lands a crewed spacecraft on the surface of Mars with at least one human astronaut who returns safely.',
    category: 'SCIENCE', expiresAt: new Date('2030-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will AGI (Artificial General Intelligence) be achieved by 2027?',
    description: 'A credible independent evaluation confirms an AI system has achieved human-level general intelligence across all domains.',
    category: 'SCIENCE', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will commercial nuclear fusion power be achieved by 2035?',
    description: 'A fusion power plant connected to the electrical grid produces net positive energy commercially.',
    category: 'SCIENCE', expiresAt: new Date('2035-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will a major breakthrough in Alzheimer\'s treatment be approved by 2027?',
    description: 'The FDA approves a treatment that demonstrably halts or reverses Alzheimer\'s progression in clinical trials.',
    category: 'SCIENCE', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Which company leads the AI race by end of 2027?',
    description: 'Which company is widely recognized as having the most capable and commercially dominant AI systems by end of 2027.',
    category: 'SCIENCE', expiresAt: new Date('2028-01-01'),
    outcomes: mc(['OpenAI', 'Google/DeepMind', 'Anthropic', 'Meta AI', 'Other']),
  },
  {
    title: 'Will the James Webb Space Telescope find signs of alien life by 2030?',
    description: 'NASA/ESA officially announces confirmed biosignatures or signs of life detected by the James Webb Telescope.',
    category: 'SCIENCE', expiresAt: new Date('2030-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will electric vehicles outsell gas cars globally by 2028?',
    description: 'Global EV sales exceed internal combustion engine vehicle sales in annual global auto sales figures.',
    category: 'SCIENCE', expiresAt: new Date('2028-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will there be a permanent Moon base by 2035?',
    description: 'A permanently inhabited lunar base with rotating crew is established on the Moon by any nation or private entity.',
    category: 'SCIENCE', expiresAt: new Date('2035-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will fully autonomous vehicles be legal in all 50 US states by 2030?',
    description: 'Level 5 autonomous vehicles (no human required) are legally permitted to operate on public roads in all 50 states.',
    category: 'SCIENCE', expiresAt: new Date('2030-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will CRISPR gene editing cure a major genetic disease by 2027?',
    description: 'FDA approves a CRISPR-based therapy that completely cures (not just treats) a major genetic disease like sickle cell or cystic fibrosis.',
    category: 'SCIENCE', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },

  // ─── TECHNOLOGY (10) ──────────────────────────────────────────────────────────
  {
    title: 'Will Apple release consumer AR glasses by end of 2026?',
    description: 'Apple announces and begins selling lightweight AR glasses (distinct from Vision Pro headset) to consumers before Jan 2027.',
    category: 'TECHNOLOGY', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Which company will first reach a $5 trillion market cap?',
    description: 'Which publicly traded company is the first to achieve a $5 trillion USD market capitalization.',
    category: 'TECHNOLOGY', expiresAt: new Date('2028-12-31'),
    outcomes: mc(['Apple', 'Microsoft', 'Nvidia', 'Alphabet (Google)', 'Other']),
  },
  {
    title: 'Will quantum computers break RSA-2048 encryption by 2030?',
    description: 'A quantum computer successfully factors a 2048-bit RSA key, breaking current encryption standards.',
    category: 'TECHNOLOGY', expiresAt: new Date('2030-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Tesla\'s Full Self-Driving reach Level 5 by 2027?',
    description: 'Tesla\'s FSD system achieves NHTSA-recognized Level 5 autonomy (no human oversight required in any condition).',
    category: 'TECHNOLOGY', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will humanoid robots be in 1 million+ homes by 2030?',
    description: 'Consumer humanoid robots (like Tesla Optimus or equivalent) are deployed in 1 million or more private households.',
    category: 'TECHNOLOGY', expiresAt: new Date('2030-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will the US pass major federal AI regulation by 2026?',
    description: 'The US Congress passes and the President signs a comprehensive federal law regulating AI systems before end of 2026.',
    category: 'TECHNOLOGY', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will nuclear power generate 25%+ of US electricity by 2035?',
    description: 'Nuclear power accounts for 25% or more of total US electricity generation, based on EIA annual data.',
    category: 'TECHNOLOGY', expiresAt: new Date('2035-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Apple Vision Pro 2 sell 1 million+ units in launch year?',
    description: 'Apple\'s next-generation spatial computing headset (Vision Pro 2) sells 1 million or more units within 12 months of launch.',
    category: 'TECHNOLOGY', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will there be a major cyberattack on US power grid in 2026?',
    description: 'A cyberattack causes widespread power outages affecting 500,000+ customers in the US in 2026.',
    category: 'TECHNOLOGY', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Which AI model leads in capability benchmarks in 2027?',
    description: 'Which AI model scores highest across major public AI benchmarks (MMLU, HumanEval, etc.) at the start of 2027.',
    category: 'TECHNOLOGY', expiresAt: new Date('2027-03-01'),
    outcomes: mc(['GPT-5 / OpenAI', 'Gemini Ultra / Google', 'Claude / Anthropic', 'Llama / Meta', 'Other']),
  },

  // ─── TECHNOLOGY (10 more) ──────────────────────────────────────────────────
  {
    title: 'Will OpenAI release GPT-5 in 2026?',
    description: 'OpenAI publicly launches GPT-5 (or equivalent next-generation model) before January 2027.',
    category: 'TECHNOLOGY', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Apple add AI-generated content features to iMessage in 2026?',
    description: 'Apple ships an iMessage feature that generates text, images, or summaries using on-device or cloud AI.',
    category: 'TECHNOLOGY', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will autonomous robotaxis operate in 10+ US cities by end of 2026?',
    description: 'Fully driverless robotaxi services (Waymo, Cruise, etc.) are available to the public in 10 or more US cities.',
    category: 'TECHNOLOGY', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will a major social media platform launch a decentralized competitor?',
    description: 'Meta, Google, or X launches a federated/decentralized social platform (like Bluesky/Mastodon model) by end of 2027.',
    category: 'TECHNOLOGY', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will 6G networks begin deployment by 2028?',
    description: 'A major telecom carrier begins commercial 6G network service (not just trials) before January 2028.',
    category: 'TECHNOLOGY', expiresAt: new Date('2028-01-01'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will GitHub Copilot write >50% of new code at a Fortune 500 company?',
    description: 'A Fortune 500 company publicly reports that AI coding assistants generate more than 50% of their new code.',
    category: 'TECHNOLOGY', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will passkeys fully replace passwords at a major bank by 2027?',
    description: 'A top-10 US bank eliminates password-based login entirely in favor of passkeys/biometrics.',
    category: 'TECHNOLOGY', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will the EU Digital Markets Act force Apple to allow sideloading globally?',
    description: 'Apple enables app sideloading on iPhones worldwide (not just EU) due to regulatory pressure.',
    category: 'TECHNOLOGY', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will AI replace >10% of call center jobs in 2026?',
    description: 'Major survey data shows AI chatbots/voice agents replaced 10%+ of human call center positions in 2026.',
    category: 'TECHNOLOGY', expiresAt: new Date('2027-03-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Starlink have 10 million subscribers by end of 2026?',
    description: 'SpaceX\'s Starlink satellite internet service reaches 10 million paid subscribers.',
    category: 'TECHNOLOGY', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },

  // ─── BUSINESS (10 more) ────────────────────────────────────────────────────
  {
    title: 'Will the S&P 500 reach 7,000 in 2026?',
    description: 'The S&P 500 index closes above 7,000 at any point in calendar year 2026.',
    category: 'BUSINESS', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will the Federal Reserve cut rates below 3% by end of 2026?',
    description: 'The US Federal Funds Rate target is set below 3.00% at any FOMC meeting in 2026.',
    category: 'BUSINESS', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Anthropic (Claude) reach $10B+ annual revenue by 2027?',
    description: 'Anthropic reports or is credibly estimated to have $10 billion or more in annualized revenue.',
    category: 'BUSINESS', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will TikTok be acquired by a US company?',
    description: 'TikTok\'s US operations are acquired by a US-based company (not just a partial stake).',
    category: 'BUSINESS', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will housing prices in the US drop 10%+ from peak?',
    description: 'The Case-Shiller US National Home Price Index drops 10% or more from its all-time high.',
    category: 'BUSINESS', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Nvidia stock price double from Jan 2026 levels?',
    description: 'NVDA stock price reaches 2x its January 2, 2026 closing price at any point in 2026.',
    category: 'BUSINESS', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will the US national debt exceed $40 trillion in 2026?',
    description: 'The total US national debt surpasses $40 trillion USD as reported by the Treasury.',
    category: 'BUSINESS', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will any company IPO at a $100B+ valuation in 2026?',
    description: 'A company goes public via IPO or direct listing with a market cap exceeding $100 billion on its first trading day.',
    category: 'BUSINESS', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will the US-China trade war escalate with new tariffs in 2026?',
    description: 'The US or China imposes new tariffs of 25%+ on additional product categories in 2026.',
    category: 'BUSINESS', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will commercial real estate defaults exceed $100B in 2026?',
    description: 'Total US commercial real estate loan defaults/delinquencies exceed $100 billion in 2026.',
    category: 'BUSINESS', expiresAt: new Date('2027-03-31'),
    outcomes: [YES, NO],
  },

  // ─── POLITICS (10 more — Polymarket-style, 2026 timely) ──────────────────────
  {
    title: 'Will Biden endorse a candidate for 2028 by June 2026?',
    description: 'Former President Biden publicly endorses a specific candidate for the 2028 presidential election before July 1, 2026.',
    category: 'POLITICS', expiresAt: new Date('2026-07-01'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will the US Senate confirm a new Supreme Court Justice in 2026?',
    description: 'A new Supreme Court Justice is confirmed by the US Senate in calendar year 2026.',
    category: 'POLITICS', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will India surpass China in population growth rate in 2026?',
    description: 'India\'s annual population growth rate exceeds China\'s based on 2026 UN estimates.',
    category: 'POLITICS', expiresAt: new Date('2027-03-01'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will any US state legalize recreational drugs beyond cannabis in 2026?',
    description: 'A US state passes legislation legalizing any recreational drug beyond marijuana (e.g., psilocybin, MDMA) in 2026.',
    category: 'POLITICS', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Who will be the Republican frontrunner for 2028 by end of 2026?',
    description: 'Who leads in Republican primary polls for the 2028 presidential nomination as of December 2026.',
    category: 'POLITICS', expiresAt: new Date('2027-01-15'),
    outcomes: mc(['JD Vance', 'Ron DeSantis', 'Nikki Haley', 'Vivek Ramaswamy', 'Other']),
  },
  {
    title: 'Will BRICS currency challenge the US dollar in 2026?',
    description: 'BRICS nations announce a shared currency or settlement system used for >5% of their bilateral trade.',
    category: 'POLITICS', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Scotland hold another independence referendum by 2028?',
    description: 'An officially sanctioned Scottish independence referendum takes place before January 2028.',
    category: 'POLITICS', expiresAt: new Date('2028-01-01'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will the US exit any international organization in 2026?',
    description: 'The US formally withdraws from WHO, NATO, WTO, UN, Paris Agreement, or equivalent international body in 2026.',
    category: 'POLITICS', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will there be a government shutdown in the US in 2026?',
    description: 'A partial or full US federal government shutdown lasting 3+ days occurs in 2026.',
    category: 'POLITICS', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Venezuela hold a free and fair election by 2027?',
    description: 'Venezuela holds a presidential election recognized as free and fair by international observers.',
    category: 'POLITICS', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },

  // ─── SPORTS (10 more) ──────────────────────────────────────────────────────
  {
    title: 'Will a 100m world record be broken at the 2026 World Athletics?',
    description: 'The men\'s or women\'s 100m dash world record is broken at the 2026 World Athletics Championships.',
    category: 'SPORTS', expiresAt: new Date('2026-09-15'),
    outcomes: [YES, NO],
  },
  {
    title: 'Who wins the 2026 Champions League?',
    description: 'Which club wins the 2025-26 UEFA Champions League final.',
    category: 'SPORTS', expiresAt: new Date('2026-06-01'),
    outcomes: mc(['Real Madrid', 'Manchester City', 'Barcelona', 'Bayern Munich', 'Other']),
  },
  {
    title: 'Will Shohei Ohtani win MVP in 2026?',
    description: 'Shohei Ohtani wins the MLB National League or American League MVP award for the 2026 season.',
    category: 'SPORTS', expiresAt: new Date('2026-11-30'),
    outcomes: [YES, NO],
  },
  {
    title: 'Who wins the 2026 Tour de France?',
    description: 'Which cyclist wins the 2026 Tour de France general classification.',
    category: 'SPORTS', expiresAt: new Date('2026-07-28'),
    outcomes: mc(['Tadej Pogacar', 'Jonas Vingegaard', 'Remco Evenepoel', 'Other']),
  },
  {
    title: 'Will an underdog (outside top 10 ranking) win the 2026 World Cup?',
    description: 'A team ranked outside the FIFA top 10 at tournament start wins the 2026 World Cup.',
    category: 'SPORTS', expiresAt: new Date('2026-07-20'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will the Los Angeles 2028 Olympics stay on budget?',
    description: 'The official LA 2028 Olympic budget does not exceed 120% of the originally approved amount.',
    category: 'SPORTS', expiresAt: new Date('2028-09-30'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will any NFL team go 17-0 in the 2026 regular season?',
    description: 'An NFL team completes a perfect 17-0 regular season in the 2026 season.',
    category: 'SPORTS', expiresAt: new Date('2027-01-15'),
    outcomes: [YES, NO],
  },
  {
    title: 'Who wins the 2026 MLB World Series?',
    description: 'Which team wins the 2026 MLB World Series.',
    category: 'SPORTS', expiresAt: new Date('2026-11-15'),
    outcomes: mc(['LA Dodgers', 'NY Yankees', 'Atlanta Braves', 'Houston Astros', 'Other']),
  },
  {
    title: 'Will a woman break the 2-hour marathon barrier by 2028?',
    description: 'A female runner completes a sanctioned marathon in under 2 hours before January 2028.',
    category: 'SPORTS', expiresAt: new Date('2028-01-01'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Jon Jones fight in 2026?',
    description: 'UFC heavyweight champion Jon Jones competes in an officially sanctioned MMA bout in calendar year 2026.',
    category: 'SPORTS', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },

  // ─── CRYPTO (10 more) ──────────────────────────────────────────────────────
  {
    title: 'Will Bitcoin dominance exceed 60% in 2026?',
    description: 'Bitcoin\'s market cap dominance exceeds 60% of total crypto market cap at any point in 2026.',
    category: 'CRYPTO', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Ethereum complete the "Pectra" upgrade without incident?',
    description: 'Ethereum\'s next major upgrade (Pectra) is deployed to mainnet without requiring an emergency rollback or hard fork fix.',
    category: 'CRYPTO', expiresAt: new Date('2026-06-30'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will a memecoin reach $100B market cap?',
    description: 'Any memecoin (DOGE, SHIB, PEPE, etc.) reaches a $100 billion USD market cap.',
    category: 'CRYPTO', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will the total crypto market cap exceed $5 trillion in 2026?',
    description: 'The total cryptocurrency market capitalization exceeds $5 trillion USD at any point in 2026.',
    category: 'CRYPTO', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will any country adopt Bitcoin as legal tender in 2026?',
    description: 'A new country (not El Salvador or CAR) officially adopts Bitcoin as legal tender in 2026.',
    category: 'CRYPTO', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will an Ethereum spot ETF outperform Bitcoin spot ETF in 2026?',
    description: 'The best-performing Ethereum spot ETF has higher YTD returns than the best-performing Bitcoin spot ETF in 2026.',
    category: 'CRYPTO', expiresAt: new Date('2027-01-10'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will DeFi TVL exceed $300B in 2026?',
    description: 'Total Value Locked across all DeFi protocols exceeds $300 billion USD at any point in 2026.',
    category: 'CRYPTO', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Which L1 blockchain will have the most daily active users in 2026?',
    description: 'Which Layer 1 blockchain has the highest average daily active addresses in Q4 2026.',
    category: 'CRYPTO', expiresAt: new Date('2027-01-31'),
    outcomes: mc(['Ethereum', 'Solana', 'Base/Coinbase', 'Tron', 'Other']),
  },
  {
    title: 'Will Tether (USDT) lose its stablecoin dominance in 2026?',
    description: 'USDT\'s share of the stablecoin market drops below 50% at any point in 2026.',
    category: 'CRYPTO', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will there be a DeFi hack exceeding $500M in 2026?',
    description: 'A single DeFi exploit or hack results in losses exceeding $500 million USD in 2026.',
    category: 'CRYPTO', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },

  // ─── ENTERTAINMENT (10 more) ───────────────────────────────────────────────
  {
    title: 'Will GTA 6 sell 50 million copies in its first month?',
    description: 'Grand Theft Auto VI sells 50 million+ copies within 30 days of launch, across all platforms.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will a K-pop group outsell Taylor Swift in global album sales in 2026?',
    description: 'Any K-pop group sells more combined album units globally than Taylor Swift in calendar year 2026.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2027-01-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will an AI-generated film be nominated for an Oscar by 2028?',
    description: 'A film primarily created using AI tools receives an Academy Award nomination in any category.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2028-03-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Spotify reach 700 million users in 2026?',
    description: 'Spotify reports 700 million or more monthly active users in any 2026 earnings report.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Which franchise will have the highest-grossing film of 2026?',
    description: 'Which film franchise earns the most worldwide box office revenue in calendar year 2026.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2027-01-31'),
    outcomes: mc(['Marvel/MCU', 'Star Wars', 'Avatar', 'Pixar/Disney Animation', 'Other']),
  },
  {
    title: 'Will MrBeast surpass 400 million YouTube subscribers in 2026?',
    description: 'MrBeast\'s main YouTube channel reaches 400 million subscribers before January 2027.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will a podcast surpass Joe Rogan in average listeners in 2026?',
    description: 'Any podcast averages more listeners per episode than The Joe Rogan Experience in 2026.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2027-01-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will there be a Hollywood actors strike in 2026?',
    description: 'SAG-AFTRA calls a strike affecting major film and TV production in 2026.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Nintendo Switch 2 outsell the original Switch launch?',
    description: 'Nintendo Switch 2 sells more units in its first 6 months than the original Switch did in its first 6 months (2.74M).',
    category: 'ENTERTAINMENT', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will a virtual concert attract 100M+ live viewers in 2026?',
    description: 'A single virtual/metaverse concert event attracts 100 million or more concurrent live viewers.',
    category: 'ENTERTAINMENT', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },

  // ─── SCIENCE (10 more) ─────────────────────────────────────────────────────
  {
    title: 'Will Neuralink receive FDA approval for its brain implant by 2027?',
    description: 'Neuralink\'s brain-computer interface receives full FDA approval (not just breakthrough device designation).',
    category: 'SCIENCE', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will a GLP-1 drug be approved for a non-obesity indication in 2026?',
    description: 'An FDA-approved GLP-1 receptor agonist (Ozempic, Wegovy, etc.) receives approval for addiction, Alzheimer\'s, or cardiovascular disease.',
    category: 'SCIENCE', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will global average temperature exceed 1.5°C above pre-industrial in 2026?',
    description: 'The global average temperature for calendar year 2026 exceeds 1.5°C above the 1850-1900 baseline.',
    category: 'SCIENCE', expiresAt: new Date('2027-03-01'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will there be a Category 6 hurricane in 2026?',
    description: 'A tropical cyclone in the Atlantic or Pacific reaches hypothetical Category 6 strength (>192 mph sustained winds) in 2026.',
    category: 'SCIENCE', expiresAt: new Date('2026-12-01'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will lab-grown meat be sold in US grocery stores in 2026?',
    description: 'Cultured/lab-grown meat products are available for purchase in major US grocery chains (Walmart, Kroger, etc.) in 2026.',
    category: 'SCIENCE', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will SpaceX Starship complete a successful orbital flight in 2026?',
    description: 'A SpaceX Starship completes a full orbital trajectory and controlled landing/recovery in 2026.',
    category: 'SCIENCE', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will an mRNA cancer vaccine receive FDA approval by 2027?',
    description: 'An mRNA-based cancer vaccine/therapy receives FDA approval for any cancer type.',
    category: 'SCIENCE', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Blue Origin successfully land humans on the Moon by 2028?',
    description: 'Blue Origin\'s lunar lander (as part of Artemis or independently) lands astronauts on the Moon.',
    category: 'SCIENCE', expiresAt: new Date('2028-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will de-extinction bring back the dodo or mammoth by 2030?',
    description: 'Colossal Biosciences or equivalent successfully births a living woolly mammoth or dodo bird.',
    category: 'SCIENCE', expiresAt: new Date('2030-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will solid-state batteries be in mass-produced EVs by 2027?',
    description: 'A major automaker (Toyota, VW, etc.) ships 10,000+ vehicles with solid-state batteries.',
    category: 'SCIENCE', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },

  // ─── BUSINESS (10) ────────────────────────────────────────────────────────────
  {
    title: 'Will Apple reach a $5 trillion market cap by end of 2026?',
    description: 'Apple Inc. (AAPL) achieves a market capitalization of $5 trillion USD at any point before January 2027.',
    category: 'BUSINESS', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will SpaceX go public (IPO) by 2027?',
    description: 'SpaceX lists shares on a public stock exchange via IPO, SPAC, or direct listing before end of 2027.',
    category: 'BUSINESS', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will there be a major US bank failure in 2026?',
    description: 'A US bank with more than $50B in assets fails and is seized by regulators in calendar year 2026.',
    category: 'BUSINESS', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will US inflation return to the 2% Fed target by end of 2025?',
    description: 'The US Consumer Price Index (CPI) year-over-year rate is at or below 2.0% for any month in 2025.',
    category: 'BUSINESS', expiresAt: new Date('2025-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will oil prices exceed $100 per barrel again in 2026?',
    description: 'Brent crude oil trades above $100 USD per barrel for at least 5 consecutive days in 2026.',
    category: 'BUSINESS', expiresAt: new Date('2026-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Which company will have the highest market cap in 2027?',
    description: 'Which company has the largest market capitalization globally at the start of 2027.',
    category: 'BUSINESS', expiresAt: new Date('2027-01-31'),
    outcomes: mc(['Apple', 'Nvidia', 'Microsoft', 'Alphabet (Google)', 'Other']),
  },
  {
    title: 'Will Amazon surpass Walmart in US retail market share by 2027?',
    description: 'Amazon\'s share of total US retail sales (including online and physical) exceeds Walmart\'s share.',
    category: 'BUSINESS', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will there be a global recession in 2026?',
    description: 'The IMF officially declares a global recession with world GDP declining in calendar year 2026.',
    category: 'BUSINESS', expiresAt: new Date('2027-03-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will Nvidia maintain its AI chip dominance through 2027?',
    description: 'Nvidia retains more than 60% of the AI training chip market share through 2027.',
    category: 'BUSINESS', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
  {
    title: 'Will remote/hybrid work become the majority for US office workers by 2027?',
    description: 'More than 50% of US white-collar workers primarily work remotely or in a hybrid arrangement.',
    category: 'BUSINESS', expiresAt: new Date('2027-12-31'),
    outcomes: [YES, NO],
  },
];

async function seed() {
  console.log(`🌱 Seeding ${MARKETS.length} markets...`);
  let created = 0;
  let skipped = 0;

  for (const m of MARKETS) {
    const existing = await prisma.market.findFirst({ where: { title: m.title } });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.market.create({
      data: {
        title: m.title,
        description: m.description,
        category: m.category,
        expiresAt: m.expiresAt,
        liquidityB: 1000,
        status: 'ACTIVE',
        outcomes: {
          create: m.outcomes.map(o => ({
            name: o.name,
            color: o.color,
            quantity: 0,
            probability: 1 / m.outcomes.length,
          })),
        },
      },
    });

    console.log(`  ✅ [${m.category}] ${m.title}`);
    created++;
  }

  console.log(`\n🎉 Done! Created: ${created}  Skipped (already exist): ${skipped}`);
}

seed()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
