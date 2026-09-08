import React from "react";

interface NexaLogoProps {
  className?: string;
  size?: number | string;
  height?: number | string;
  width?: number | string;
  color?: string;
}

export const NexaEmblemLogo: React.FC<NexaLogoProps> = ({
  className = "",
  size,
  height = 36,
  width,
  color = "#ffffff", // Not used for the image, kept for API compatibility
}) => {
  const finalHeight = size || height || 36;
  const finalWidth = size || width || "auto";

  return (
    <img
      src="https://i.postimg.cc/KY51tq6s/(2)-Photoroom.png"
      alt="Dev Logo"
      className={`inline-block select-none transition-transform duration-200 hover:scale-105 ${className}`}
      style={{
        height: finalHeight,
        width: finalWidth === "auto" ? "auto" : finalWidth,
        aspectRatio: "1/1",
        objectFit: "contain",
      }}
      draggable={false}
      referrerPolicy="no-referrer"
    />
  );
};

export const StarEmblemLogo = NexaEmblemLogo;

export const NexaLogo: React.FC<{
  className?: string;
  height?: number | string;
  width?: number | string;
  showText?: boolean;
  color?: string;
}> = ({
  className = "",
  height = 34,
  width = "auto",
  showText = true,
  color = "#ffffff",
}) => {
  return (
    <div
      className={`inline-flex items-center gap-3 select-none ${className}`}
      style={{ height, width: width === "auto" ? "auto" : width }}
    >
      <NexaEmblemLogo height={height} color={color} />
      {showText && (
        <span 
          className="text-white font-bold tracking-[0.18em] text-[17px] select-none flex items-center drop-shadow-xs"
          style={{ fontFamily: "'Michroma', sans-serif", color }}
        >
          DEV
        </span>
      )}
    </div>
  );
};

export const ZeroworkLogo = NexaLogo;
export const DevLogo = NexaLogo;

