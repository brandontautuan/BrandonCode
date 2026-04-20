/** Parse a single-line reply to "Apply? [y/n/e]:" */
export function parseApproval(line: string): "y" | "n" | "e" {
  const first = line.trim().toLowerCase()[0];
  if (first === "e") return "e";
  if (first === "y") return "y";
  return "n";
}
