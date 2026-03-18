// Prediction Questions by Category
// 20 questions per category for the prediction market

export interface PredictionQuestion {
  id: string;
  title: string;
  description: string;
  category: string;
  expiresAt: string;
}

export const PREDICTION_QUESTIONS: Record<string, PredictionQuestion[]> = {
  POLITICS: [
    { id: 'pol-1', title: 'Will Trump win the 2028 Presidential Election?', description: 'Donald Trump wins the 2028 US Presidential Election', category: 'POLITICS', expiresAt: '2028-11-05' },
    { id: 'pol-2', title: 'Will the US enter a recession in 2025?', description: 'US economy officially enters a recession as defined by NBER', category: 'POLITICS', expiresAt: '2025-12-31' },
    { id: 'pol-3', title: 'Will Bitcoin be declared legal tender in a major country?', description: 'A G20 country adopts Bitcoin as legal tender', category: 'POLITICS', expiresAt: '2026-12-31' },
    { id: 'pol-4', title: 'Will the UK rejoin the EU by 2030?', description: 'United Kingdom formally rejoins the European Union', category: 'POLITICS', expiresAt: '2030-12-31' },
    { id: 'pol-5', title: 'Will there be a government shutdown in US in 2025?', description: 'Federal government experiences a shutdown lasting 1+ day', category: 'POLITICS', expiresAt: '2025-12-31' },
    { id: 'pol-6', title: 'Will France have a new President by 2027?', description: 'France elects a new President before end of 2027', category: 'POLITICS', expiresAt: '2027-12-31' },
    { id: 'pol-7', title: 'Will NATO expand to include Ukraine?', description: 'Ukraine becomes official NATO member', category: 'POLITICS', expiresAt: '2027-12-31' },
    { id: 'pol-8', title: 'Will US pass comprehensive immigration reform?', description: 'Bipartisan immigration bill passes both houses of Congress', category: 'POLITICS', expiresAt: '2026-12-31' },
    { id: 'pol-9', title: 'Will there be a new Israeli-Palestinian peace deal?', description: 'Major peace agreement signed between Israel and Palestine', category: 'POLITICS', expiresAt: '2027-12-31' },
    { id: 'pol-10', title: 'Will Supreme Court expand to 15 justices?', description: 'US Congress passes law expanding Supreme Court', category: 'POLITICS', expiresAt: '2028-12-31' },
    { id: 'pol-11', title: 'Will California become independent?', description: 'California declares independence from the US', category: 'POLITICS', expiresAt: '2030-12-31' },
    { id: 'pol-12', title: 'Will the US eliminate the filibuster?', description: 'Senate eliminates the filibuster rule', category: 'POLITICS', expiresAt: '2027-12-31' },
    { id: 'pol-13', title: 'Will China invade Taiwan?', description: 'Military invasion of Taiwan by China', category: 'POLITICS', expiresAt: '2027-12-31' },
    { id: 'pol-14', title: 'Will a woman be elected US President by 2028?', description: 'Female candidate wins US Presidential election', category: 'POLITICS', expiresAt: '2028-11-05' },
    { id: 'pol-15', title: 'Will US recognize Palestine as a state?', description: 'US officially recognizes Palestinian state', category: 'POLITICS', expiresAt: '2026-12-31' },
    { id: 'pol-16', title: 'Will the EU adopt a constitution?', description: 'European Union adopts a formal constitution', category: 'POLITICS', expiresAt: '2028-12-31' },
    { id: 'pol-17', title: 'Will Russia use nuclear weapons in 2025?', description: 'Russia deploys nuclear weapons in conflict', category: 'POLITICS', expiresAt: '2025-12-31' },
    { id: 'pol-18', title: 'Will Netanyhu be indicted?', description: 'Benjamin Netanyahu faces criminal charges', category: 'POLITICS', expiresAt: '2026-12-31' },
    { id: 'pol-19', title: 'Will US switch to universal healthcare?', description: 'Single-payer healthcare system implemented', category: 'POLITICS', expiresAt: '2028-12-31' },
    { id: 'pol-20', title: 'Will major war break out in Middle East?', description: 'Full-scale war involving 3+ Middle Eastern countries', category: 'POLITICS', expiresAt: '2026-12-31' },
  ],
  SPORTS: [
    { id: 'spo-1', title: 'Will Chiefs win Super Bowl 2025?', description: 'Kansas City Chiefs win Super Bowl LX', category: 'SPORTS', expiresAt: '2026-02-09' },
    { id: 'spo-2', title: 'Will LeBron win 5th NBA Championship?', description: 'LeBron James wins 5th NBA title with any team', category: 'SPORTS', expiresAt: '2026-06-30' },
    { id: 'spo-3', title: 'Will Messi win World Cup 2026?', description: 'Argentina wins 2026 FIFA World Cup', category: 'SPORTS', expiresAt: '2026-07-19' },
    { id: 'spo-4', title: 'Will Tiger Woods win another major?', description: 'Tiger Woods wins any PGA Tour major tournament', category: 'SPORTS', expiresAt: '2026-12-31' },
    { id: 'spo-5', title: 'Will Brady return to NFL?', description: 'Tom Brady unretires and plays again', category: 'SPORTS', expiresAt: '2025-09-01' },
    { id: 'spo-6', title: 'Will Lakers make playoffs 2025?', description: 'Los Angeles Lakers qualify for NBA playoffs', category: 'SPORTS', expiresAt: '2025-04-15' },
    { id: 'spo-7', title: 'Will Real Madrid win Champions League?', description: 'Real Madrid wins 2024-25 UEFA Champions League', category: 'SPORTS', expiresAt: '2025-05-31' },
    { id: 'spo-8', title: 'Will Djokovic win Grand Slam in 2025?', description: 'Novak Djokovic wins any 2025 Grand Slam', category: 'SPORTS', expiresAt: '2025-09-15' },
    { id: 'spo-9', title: 'Will Ohtani hit 50 HR?', description: 'Shohei Ohtani hits 50+ home runs in season', category: 'SPORTS', expiresAt: '2025-10-01' },
    { id: 'spo-10', title: 'Will England win Cricket World Cup?', description: 'England wins 2027 ICC Cricket World Cup', category: 'SPORTS', expiresAt: '2027-03-15' },
    { id: 'spo-11', title: 'Will Hamilton win 8th F1 championship?', description: 'Lewis Hamilton wins 8th Formula 1 World Championship', category: 'SPORTS', expiresAt: '2025-12-01' },
    { id: 'spo-12', title: 'Will USMNT win Gold Cup?', description: 'USA wins 2025 CONCACAF Gold Cup', category: 'SPORTS', expiresAt: '2025-07-01' },
    { id: 'spo-13', title: 'Will Warriors win NBA Finals?', description: 'Golden State Warriors win 2025 NBA Championship', category: 'SPORTS', expiresAt: '2025-06-15' },
    { id: 'spo-14', title: 'Will Ronaldo retire in 2025?', description: 'Cristiano Ronaldo announces retirement', category: 'SPORTS', expiresAt: '2025-12-31' },
    { id: 'spo-15', title: 'Will PGA merge with LIV Golf?', description: 'PGA Tour and LIV Golf complete merger', category: 'SPORTS', expiresAt: '2025-06-30' },
    { id: 'spo-16', title: 'Will Kentucky win NCAA Championship?', description: 'Kentucky Wildcats win 2025 NCAA Basketball Championship', category: 'SPORTS', expiresAt: '2025-04-08' },
    { id: 'spo-17', title: 'Will Jets make playoffs?', description: 'New York Jets qualify for NFL playoffs', category: 'SPORTS', expiresAt: '2025-01-05' },
    { id: 'spo-18', title: 'Will Naomi Osaka win Grand Slam?', description: 'Naomi Osaka wins any 2025 Grand Slam', category: 'SPORTS', expiresAt: '2025-09-15' },
    { id: 'spo-19', title: 'Will Canelo win undisputed title?', description: 'Canelo Alvarez becomes undisputed champion', category: 'SPORTS', expiresAt: '2025-12-31' },
    { id: 'spo-20', title: 'Will Man City win Premier League?', description: 'Manchester City wins 2024-25 Premier League', category: 'SPORTS', expiresAt: '2025-05-15' },
  ],
  CRYPTO: [
    { id: 'cry-1', title: 'Will Bitcoin hit $150k by end of 2025?', description: 'Bitcoin reaches $150,000 USD on major exchange', category: 'CRYPTO', expiresAt: '2025-12-31' },
    { id: 'cry-2', title: 'Will Ethereum reach $10k?', description: 'ETH reaches $10,000 USD', category: 'CRYPTO', expiresAt: '2026-12-31' },
    { id: 'cry-3', title: 'Will Solana flip Ethereum?', description: 'Solana market cap exceeds Ethereum', category: 'CRYPTO', expiresAt: '2027-12-31' },
    { id: 'cry-4', title: 'Will SEC approve Bitcoin ETF?', description: 'SEC approves spot Bitcoin ETF', category: 'CRYPTO', expiresAt: '2025-06-30' },
    { id: 'cry-5', title: 'Will Dogecoin reach $1?', description: 'Dogecoin reaches $1.00 USD', category: 'CRYPTO', expiresAt: '2026-12-31' },
    { id: 'cry-6', title: 'Will Coinbase go bankrupt?', description: 'Coinbase files for bankruptcy', category: 'CRYPTO', expiresAt: '2026-12-31' },
    { id: 'cry-7', title: 'Will Ethereum go POS?', description: 'Ethereum fully transitions to Proof of Stake', category: 'CRYPTO', expiresAt: '2025-06-30' },
    { id: 'cry-8', title: 'Will Crypto market cap exceed $10T?', description: 'Total crypto market cap reaches $10 trillion', category: 'CRYPTO', expiresAt: '2027-12-31' },
    { id: 'cry-9', title: 'Will Binance be shut down?', description: 'Binance operations forced to cease in US', category: 'CRYPTO', expiresAt: '2025-12-31' },
    { id: 'cry-10', title: 'Will Bitcoin mining be banned in US?', description: 'US implements ban on Bitcoin mining', category: 'CRYPTO', expiresAt: '2026-12-31' },
    { id: 'cry-11', title: 'Will stablecoin market exceed $1T?', description: 'Total stablecoin supply exceeds $1 trillion', category: 'CRYPTO', expiresAt: '2027-12-31' },
    { id: 'cry-12', title: 'Will ETH exceed Bitcoin performance?', description: 'ETH returns exceed BTC returns in 2025', category: 'CRYPTO', expiresAt: '2025-12-31' },
    { id: 'cry-13', title: 'Will NFT market recover?', description: 'NFT sales volume exceeds 2021 peak', category: 'CRYPTO', expiresAt: '2027-12-31' },
    { id: 'cry-14', title: 'Will major bank adopt crypto?', description: 'JPMorgan, Goldman, or Morgan Stanley adopts Bitcoin', category: 'CRYPTO', expiresAt: '2025-12-31' },
    { id: 'cry-15', title: 'Will Ripple win SEC case?', description: 'Ripple wins summary judgment vs SEC', category: 'CRYPTO', expiresAt: '2025-06-30' },
    { id: 'cry-16', title: 'Will Meme coins dominate volume?', description: 'Meme coins exceed 50% of DEX volume', category: 'CRYPTO', expiresAt: '2026-12-31' },
    { id: 'cry-17', title: 'Will Bitcoin reach $1M?', description: 'Bitcoin reaches $1,000,000 USD', category: 'CRYPTO', expiresAt: '2030-12-31' },
    { id: 'cry-18', title: 'Will DeFiTVL exceed $500B?', description: 'Total DeFi value locked exceeds $500 billion', category: 'CRYPTO', expiresAt: '2027-12-31' },
    { id: 'cry-19', title: 'Will country adopt Bitcoin as reserve?', description: 'Major country adds Bitcoin to reserves', category: 'CRYPTO', expiresAt: '2026-12-31' },
    { id: 'cry-20', title: 'Will crypto regulations pass US?', description: 'Comprehensive crypto legislation passes Congress', category: 'CRYPTO', expiresAt: '2026-12-31' },
  ],
  ENTERTAINMENT: [
    { id: 'ent-1', title: 'Will Taylor Swift retire?', description: 'Taylor Swift announces retirement from music', category: 'ENTERTAINMENT', expiresAt: '2026-12-31' },
    { id: 'ent-2', title: 'Will Beyonce go on world tour?', description: 'Beyoncé announces world tour', category: 'ENTERTAINMENT', expiresAt: '2025-12-31' },
    { id: 'ent-3', title: 'Will Avatar 3 be highest grossing film?', description: 'Avatar: Fire and Ash becomes highest-grossing film', category: 'ENTERTAINMENT', expiresAt: '2025-12-31' },
    { id: 'ent-4', title: 'Will Avengers beat Avatar box office?', description: 'Avengers: Doomsday surpasses Avatar worldwide', category: 'ENTERTAINMENT', expiresAt: '2026-12-31' },
    { id: 'ent-5', title: 'Will Netflix stock exceed $1000?', description: 'Netflix share price exceeds $1000', category: 'ENTERTAINMENT', expiresAt: '2026-12-31' },
    { id: 'ent-6', title: 'Will Star Wars be acquired?', description: 'Disney sells Lucasfilm to another company', category: 'ENTERTAINMENT', expiresAt: '2027-12-31' },
    { id: 'ent-7', title: 'Will streaming merge happen?', description: 'Major streaming service merger announced', category: 'ENTERTAINMENT', expiresAt: '2026-06-30' },
    { id: 'ent-8', title: 'Will GTA 6 release in 2025?', description: 'Grand Theft Auto VI officially launches', category: 'ENTERTAINMENT', expiresAt: '2025-12-31' },
    { id: 'ent-9', title: 'Will Beatles reunite via AI?', description: 'New Beatles song released using AI', category: 'ENTERTAINMENT', expiresAt: '2025-09-30' },
    { id: 'ent-10', title: 'Will Oscars add streaming category?', description: 'Oscars create Best Streaming Film category', category: 'ENTERTAINMENT', expiresAt: '2026-03-01' },
    { id: 'ent-11', title: 'Will Spider-Man join MCU permanently?', description: 'Spider-Man fully returns to Marvel', category: 'ENTERTAINMENT', expiresAt: '2026-12-31' },
    { id: 'ent-12', title: 'Will Game of Thrones spin-off succeed?', description: 'GOT spin-off becomes biggest TV show', category: 'ENTERTAINMENT', expiresAt: '2025-12-31' },
    { id: 'ent-13', title: 'Will TikTok be banned in US?', description: 'TikTok banned in United States', category: 'ENTERTAINMENT', expiresAt: '2025-04-30' },
    { id: 'ent-14', title: 'Will Netflix add ads?', description: 'Netflix launches ad-supported tier', category: 'ENTERTAINMENT', expiresAt: '2024-12-31' },
    { id: 'ent-15', title: 'Will Marvel surpass Batman?', description: 'Marvel becomes highest-grossing franchise', category: 'ENTERTAINMENT', expiresAt: '2026-12-31' },
    { id: 'ent-16', title: 'Will Metallica tour?', description: 'Metallica announces world tour', category: 'ENTERTAINMENT', expiresAt: '2025-12-31' },
    { id: 'ent-17', title: 'Will video game movie break record?', description: 'Video game adaptation becomes highest-grossing film', category: 'ENTERTAINMENT', expiresAt: '2026-12-31' },
    { id: 'ent-18', title: 'Will Spotify become profitable?', description: 'Spotify reports first profitable quarter', category: 'ENTERTAINMENT', expiresAt: '2025-06-30' },
    { id: 'ent-19', title: 'Will Oscars viewership exceed 100M?', description: 'Oscars achieve 100M+ viewers', category: 'ENTERTAINMENT', expiresAt: '2026-03-01' },
    { id: 'ent-20', title: 'Will Michael Jackson hologram tour?', description: 'Michael Jackson hologram tour announced', category: 'ENTERTAINMENT', expiresAt: '2026-12-31' },
  ],
  SCIENCE: [
    { id: 'sci-1', title: 'Will SpaceX land on Mars?', description: 'SpaceX successfully lands on Mars surface', category: 'SCIENCE', expiresAt: '2030-12-31' },
    { id: 'sci-2', title: 'Will NASA return to Moon?', description: 'NASA Artemis program lands on Moon', category: 'SCIENCE', expiresAt: '2027-12-31' },
    { id: 'sci-3', title: 'Will AI pass Turing test?', description: 'AI passes official Turing test', category: 'SCIENCE', expiresAt: '2027-12-31' },
    { id: 'sci-4', title: 'Will fusion be commercially viable?', description: 'Fusion power plant goes online', category: 'SCIENCE', expiresAt: '2035-12-31' },
    { id: 'sci-5', title: 'Will we find alien life?', description: 'Evidence of extraterrestrial life discovered', category: 'SCIENCE', expiresAt: '2030-12-31' },
    { id: 'sci-6', title: 'Will cancer be cured?', description: 'Major breakthrough in cancer treatment', category: 'SCIENCE', expiresAt: '2028-12-31' },
    { id: 'sci-7', title: 'Will telomere therapy work?', description: 'Anti-aging telomere therapy proven effective', category: 'SCIENCE', expiresAt: '2030-12-31' },
    { id: 'sci-8', title: 'Will AGI be achieved?', description: 'Artificial General Intelligence achieved', category: 'SCIENCE', expiresAt: '2030-12-31' },
    { id: 'sci-9', title: 'Will quantum computing break encryption?', description: 'Quantum computer cracks RSA-2048', category: 'SCIENCE', expiresAt: '2030-12-31' },
    { id: 'sci-10', title: 'Will climate target be met?', description: 'Global temperature rise below 1.5C', category: 'SCIENCE', expiresAt: '2030-12-31' },
    { id: 'sci-11', title: 'Will Mars colony be established?', description: 'First permanent Mars colony established', category: 'SCIENCE', expiresAt: '2035-12-31' },
    { id: 'sci-12', title: 'Will brain-computer interface work?', description: 'BCI enables direct neural communication', category: 'SCIENCE', expiresAt: '2028-12-31' },
    { id: 'sci-13', title: 'Will cure for HIV found?', description: 'Effective HIV cure discovered', category: 'SCIENCE', expiresAt: '2028-12-31' },
    { id: 'sci-14', title: 'Will nuclear fusion exceed break-even?', description: 'Fusion produces more energy than consumed', category: 'SCIENCE', expiresAt: '2027-12-31' },
    { id: 'sci-15', title: 'Will we find cure for Alzheimer?', description: 'Alzheimer disease progression reversed', category: 'SCIENCE', expiresAt: '2030-12-31' },
    { id: 'sci-16', title: 'Will hovercars be common?', description: 'Personal flying vehicles in mass production', category: 'SCIENCE', expiresAt: '2035-12-31' },
    { id: 'sci-17', title: 'Will teleport be possible?', description: 'Quantum teleportation of complex molecules', category: 'SCIENCE', expiresAt: '2030-12-31' },
    { id: 'sci-18', title: 'Will gene editing cure genetic diseases?', description: 'CRISPR cures inherited disease', category: 'SCIENCE', expiresAt: '2027-12-31' },
    { id: 'sci-19', title: 'Will renewable exceed fossil fuels?', description: 'Renewable energy surpasses fossil fuel use globally', category: 'SCIENCE', expiresAt: '2030-12-31' },
    { id: 'sci-20', title: 'Will flying taxi launch?', description: 'Commercial flying taxi service begins', category: 'SCIENCE', expiresAt: '2028-12-31' },
  ],
};

// Helper function to get questions by category
export function getQuestionsByCategory(category: string): PredictionQuestion[] {
  return PREDICTION_QUESTIONS[category.toUpperCase()] || [];
}

// Helper function to get all categories
export function getCategories(): string[] {
  return Object.keys(PREDICTION_QUESTIONS);
}

// Helper function to get random question
export function getRandomQuestion(): PredictionQuestion {
  const categories = getCategories();
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  const questions = PREDICTION_QUESTIONS[randomCategory];
  return questions[Math.floor(Math.random() * questions.length)];
}
