export async function importResource<T, TName extends string>(
  path: string,
  namedImport: TName
) {
  const itemImport: Record<TName | "default", T | undefined> = await import(
    path
  );
  return itemImport[namedImport] ?? itemImport.default;
}
