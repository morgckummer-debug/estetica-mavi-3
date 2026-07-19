type Props = {
  className?: string;
  variant?: 1 | 2 | 3;
};

const paths = {
  1: "M421.5 75.5C489 113 540 197 528 281C516 365 441 449 350 470C259 491 152 449 84 376C16 303 -13 199 28 121C69 43 167 -9 257 1.5C347 12 354 38 421.5 75.5Z",
  2: "M398 60C475 120 510 220 475 312C440 404 335 488 230 478C125 468 20 364 6 260C-8 156 70 52 175 18C280 -16 321 0 398 60Z",
  3: "M440 100C500 175 510 285 450 365C390 445 260 495 165 460C70 425 10 305 25 210C40 115 130 35 230 20C330 5 380 25 440 100Z",
};

export function OrganicBlob({ className, variant = 1 }: Props) {
  return (
    <svg
      viewBox="0 0 540 500"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path d={paths[variant]} fill="currentColor" />
    </svg>
  );
}