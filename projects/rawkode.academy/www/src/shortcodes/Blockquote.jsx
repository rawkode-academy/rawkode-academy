import { TfiQuoteLeft } from "react-icons/tfi/index.js";

const Blockquote = ({ name, children }) => {
  return (
    <blockquote className="border-border-secondary rounded-xl border bg-body px-8 py-3  not-italic">
      <span className="text-5xl text-gray-400">
        <TfiQuoteLeft />
      </span>
      {children}
      <span className="border-border-secondary m-0 block border-t pt-3 text-base font-normal text-text after:hidden">
        {name}
      </span>
    </blockquote>
  );
};

export default Blockquote;
