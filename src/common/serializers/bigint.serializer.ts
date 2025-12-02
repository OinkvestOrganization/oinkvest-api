/**
 * Serializer customizado para converter BigInt em string
 * Evita erro: "Do not know how to serialize a BigInt"
 */
export class BigIntSerializer {
  static replacer(key: string, value: any): any {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }

  static transform(obj: any): any {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'bigint') {
      return obj.toString();
    }

    if (typeof obj === 'object') {
      if (Array.isArray(obj)) {
        return obj.map((item) => BigIntSerializer.transform(item));
      }

      const transformed: any = {};
      for (const [key, value] of Object.entries(obj)) {
        transformed[key] = BigIntSerializer.transform(value);
      }
      return transformed;
    }

    return obj;
  }
}
