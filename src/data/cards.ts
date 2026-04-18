export type ProfileCardData = {
  id: string;
  role: string;
  name: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  imageClassName?: string;
};

const withBase = (path: string) =>
  `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

const withStaticVersion = (path: string) => `${withBase(path)}?v=figma-static-2`;

export const onePieceCards: ProfileCardData[] = [
  {
    id: "robin",
    role: "Archeologist",
    name: "Nico Robin",
    description:
      "Calm, intelligent, and slightly terrifying when needed. Robin has a dark sense of humor and a love for ancient history-and occasionally imagining your gruesome demise mid-conversation. She's elegance with danger quietly built in.",
    imageSrc: withStaticVersion("/characters/robin.png"),
    imageAlt: "Black line illustration of Nico Robin",
    imageClassName: "h-[214px] w-[190px] translate-y-[-8px]",
  },
  {
    id: "zoro",
    role: "Vice-Captain",
    name: "Roronoa Zoro",
    description:
      "A master of three-sword style who cuts through enemies and occasionally his sense of direction. Zoro lives for strength and loyalty. If he's not training, he's probably sleeping... or lost somewhere he definitely shouldn't be.",
    imageSrc: withStaticVersion("/characters/zoro.png"),
    imageAlt: "Black line illustration of Roronoa Zoro",
    imageClassName: "h-[214px] w-[190px] translate-y-[-8px]",
  },
  {
    id: "luffy",
    role: "Captain & Yonko",
    name: "Monkey D. Luffy",
    description:
      "Charges headfirst into danger, laughs through chaos, and somehow turns impossible odds into victories. Powered by pure freedom, loyalty, and meat, he's the kind of captain who'd start a war... just to save a friend.",
    imageSrc: withStaticVersion("/characters/luffy.png"),
    imageAlt: "Black line illustration of Monkey D. Luffy",
  },
  {
    id: "nami",
    role: "Navigator",
    name: "Nami",
    description:
      "A genius navigator with a love for money almost as strong as her love for survival. Nami controls the weather, the crew, and especially their wallets. she'll guide you through any storm... just don't expect it to be free.",
    imageSrc: withStaticVersion("/characters/nami.png"),
    imageAlt: "Black line illustration of Nami",
    imageClassName: "h-[210px] w-[196px] translate-y-[-6px]",
  },
  {
    id: "sanji",
    role: "Cook",
    name: "Vinsmoke Sanji",
    description:
      "A world-class chef who fights with his feet and falls in love every five seconds. Sanji is smooth, dramatic, and dangerously skilled. He'll protect any lady with his life... even if it kills him (and it almost always does).",
    imageSrc: withStaticVersion("/characters/sanji.png"),
    imageAlt: "Black line illustration of Vinsmoke Sanji",
    imageClassName: "h-[214px] w-[208px] translate-y-[-8px]",
  },
];
