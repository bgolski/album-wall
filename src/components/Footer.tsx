import React from "react";

interface FooterProps {
  ownerName?: string;
}

export const Footer: React.FC<FooterProps> = ({ ownerName = "Bradley Golski" }) => {
  return (
    <div className="mt-8 py-4 text-center text-gray-400 text-sm border-t border-gray-700">
      <p>
        © {new Date().getFullYear()} {ownerName}
      </p>
    </div>
  );
};

export default Footer;
