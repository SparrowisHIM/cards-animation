import { FiveCardStack } from "./components/FiveCardStack";
import { onePieceCards } from "./data/cards";

export default function App() {
  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-[#d8d2c8] px-4 py-16 sm:px-8">
      <FiveCardStack cards={onePieceCards} initialActiveIndex={2} />
    </main>
  );
}
