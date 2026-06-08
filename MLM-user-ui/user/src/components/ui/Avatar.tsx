import React from "react";

type AvatarProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  size?: number;
  ring?: boolean;
  rounded?: "full" | "lg";
};

export function Avatar({
  size = 40,
  ring = false,
  rounded = "full",
  className = "",
  style,
  ...props
}: AvatarProps) {
  const roundedCls = rounded === "full" ? "rounded-full" : "rounded-lg";
  return (
    <img
      className={[
        roundedCls,
        "object-cover",
        ring
          ? "border-4 border-blue-600/70 shadow-[0_0_10px_rgba(37,99,235,0.2)]"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width: size, height: size, ...(style || {}) }}
      {...props}
    />
  );
}

export default Avatar;
