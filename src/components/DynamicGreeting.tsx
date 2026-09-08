import React from "react";

export const DynamicGreeting: React.FC = () => {
  return (
    <div className="min-h-[64px] sm:min-h-[76px] flex items-center justify-center px-2 select-none">
      <h1 className="font-thai text-3xl sm:text-4xl md:text-[42px] font-medium tracking-tight leading-tight text-center">
        <span className="text-[#e3e3e3]">มีอะไรให้ </span>
        <span className="bg-gradient-to-r from-[#8ab4f8] via-[#a8c7fa] to-blue-400 bg-clip-text text-transparent font-semibold">
          DEV ช่วยคุณบ้าง
        </span>
      </h1>
    </div>
  );
};
