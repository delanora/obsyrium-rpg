export const ACTIVE_INSTALLATIONS: readonly string[];
export function canonicalPath(input: string, base?: string): string;
export function inside(candidate: string, parent: string): boolean;
export function assertSafeBuild(options: {
  sources: string[];
  outputs?: string[];
}): void;
export function assertSafeViteConfig(config: unknown, origins?: string[]): void;
