export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function outputResult<T>(
  data: T,
  tableRenderer: (data: T) => void,
  jsonFlag: boolean
): void {
  if (jsonFlag) {
    printJson(data);
  } else {
    tableRenderer(data);
  }
}
