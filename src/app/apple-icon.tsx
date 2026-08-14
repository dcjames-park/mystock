import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4F6EF7",
        }}
      >
        <svg
          width="180"
          height="180"
          viewBox="0 0 32 32"
          fill="none"
        >
          <circle cx="7.5" cy="8.5" r="2.15" fill="#fff" />
          <circle cx="7.5" cy="16" r="2.15" fill="#5EC8C5" />
          <circle cx="7.5" cy="23.5" r="2.15" fill="#C4B5FD" />
          <path
            d="M10 8.5C14 8.5 15 14 18.5 16"
            stroke="#fff"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
          <path
            d="M10 16H18.5"
            stroke="#fff"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
          <path
            d="M10 23.5C14 23.5 15 18 18.5 16"
            stroke="#fff"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
          <path
            d="M18.5 16 22 20 26 13 29.5 8.5V28H18.5Z"
            fill="rgba(255,255,255,0.22)"
          />
          <path
            d="M18.5 16 22 20 26 13 29.5 8.5"
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
