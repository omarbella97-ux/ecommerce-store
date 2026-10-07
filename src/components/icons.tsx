import type { SVGProps } from "react";

// 1.25px-stroke line icons on a 24px grid, drawn in currentColor.
function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      aria-hidden="true"
      {...props}
    />
  );
}

export function SearchIcon() {
  return (
    <Icon>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Icon>
  );
}

export function AccountIcon() {
  return (
    <Icon>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6" />
    </Icon>
  );
}

export function BagIcon() {
  return (
    <Icon>
      <path d="M4.5 8.5h15l-1 12h-13z" />
      <path d="M8.5 8.5V7a3.5 3.5 0 0 1 7 0v1.5" />
    </Icon>
  );
}

export function MenuIcon() {
  return (
    <Icon>
      <path d="M3.5 7h17M3.5 12h17M3.5 17h17" />
    </Icon>
  );
}

export function CloseIcon() {
  return (
    <Icon>
      <path d="m5 5 14 14M19 5 5 19" />
    </Icon>
  );
}
