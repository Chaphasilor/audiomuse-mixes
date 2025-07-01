export function parseVector<T = MoodVector | OtherFeaturesVector>(
  rawVector: string,
): T {
  return rawVector.split(`,`)
    .map((value: string) => value.split(`:`)).reduce(
      (acc: Record<string, number>, [key, value]: string[]) => {
        acc[key] = parseFloat(value);
        return acc;
      },
      {},
    ) as T;
}
