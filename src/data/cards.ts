export type ProfileCardData = {
  id: string;
  role: string;
  name: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
};

const withBase = (path: string) =>
  `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

const withStaticVersion = (path: string) => `${withBase(path)}?v=work-1`;

export const workCards: ProfileCardData[] = [
  {
    id: "nine41",
    role: "Open-source tool",
    name: "nine41",
    description:
      "A command-line tool that films a website the way it looks on a real device: true 3x iPhone frames under a live status bar, or a Retina laptop with a moving pointer, at 60 fps. I film all my work with it.",
    imageSrc: withStaticVersion("/work/nine41.webp"),
    imageAlt: "Mimi Crochet in a MacBook and Ferry in an iPhone, both filmed with nine41",
  },
  {
    id: "ferry",
    role: "Concept bank",
    name: "Ferry",
    description:
      "A bank on your phone that tells you when your money lands. A payday forecast on Home, money you slide to a person, receipts for everything, and a card that frosts over when you freeze it.",
    imageSrc: withStaticVersion("/work/ferry.webp"),
    imageAlt: "Ferry's Home: You're covered until Nov 7, above a balance of $1,486.20",
  },
  {
    id: "mimi-crochet",
    role: "Shop & studio",
    name: "Mimi Crochet",
    description:
      "A website for Mimi's handmade crochet: a shop, custom orders with voice notes, a private page for every order and a studio app for her. It's live and takes real payments.",
    imageSrc: withStaticVersion("/work/mimi-crochet.webp"),
    imageAlt: "Mimi Crochet's shop: Crochet pieces worth being seen in, beside a red crochet set",
  },
  {
    id: "growth-card",
    role: "Component",
    name: "GrowthCard",
    description:
      "A growth widget you read by pulling a tape back through the months. It counts up once it scrolls into view, then you drag along the timeline to read any month.",
    imageSrc: withStaticVersion("/work/growth-card.webp"),
    imageAlt: "GrowthCard: 10,000 followers over a glowing growth line, with the tape on the left",
  },
  {
    id: "transaction-status",
    role: "Component",
    name: "Transaction status",
    description:
      "A wallet toast for a token swap where the coins are the progress: when the swap lands, they trade places. It knows a slow network and a swap that fails, too.",
    imageSrc: withStaticVersion("/work/transaction-status.webp"),
    imageAlt: "A toast reading Swapped, +185.40 USDC for 0.05 ETH",
  },
];
