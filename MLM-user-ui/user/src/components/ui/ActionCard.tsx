import React from "react";
import Link from "next/link";
import { Card } from "./Card";
import Button from "./Button";
import { H3 } from "./Heading";
import { Badge } from "./Badge";
import { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

type ActionCardProps = {
  title: string;
  text: string;
  btn: string;
  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "danger"
    | "warning";
  icon: LucideIcon;
  gradient: string;
  badge?: string;
  onClick?: () => void;
  href?: string;
  className?: string;
};

export function ActionCard({
  title,
  text,
  btn,
  variant = "primary",
  icon: Icon,
  gradient,
  badge,
  onClick,
  href,
  className = "",
}: ActionCardProps) {
  return (
    <Card
      className={`min-h-[180px] p-6 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden ${className}`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br opacity-10 group-hover:opacity-20 transition-opacity duration-300 rounded-full -mr-16 -mt-16"></div>
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <H3 className="mb-0">{title}</H3>
              {badge && (
                <Badge tone="amber" size="sm" rounded="full" className="mt-1">
                  {badge}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <p className="m-0 text-sm text-[var(--text-body)] mb-4 leading-relaxed font-medium">
          {text}
        </p>
      </div>
      {href ? (
        <Link href={href} className="block">
          <Button
            variant={variant}
            className="relative z-10 group-hover:shadow-lg transition-all duration-300 w-full"
            onClick={onClick}
          >
            <span className="flex items-center gap-2">
              {btn}
              <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform duration-300" />
            </span>
          </Button>
        </Link>
      ) : (
      <Button
        variant={variant}
        className="relative z-10 group-hover:shadow-lg transition-all duration-300"
        onClick={onClick}
      >
        <span className="flex items-center gap-2">
          {btn}
          <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform duration-300" />
        </span>
      </Button>
      )}
    </Card>
  );
}

export default ActionCard;
