type ExchangeCredential = {
  id: string;
  userId: string;
  exchange: string;
  apiKey: string;
  apiSecret: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type WalletBalance = {
  userId: string;
  asset: string;
  free: string;
  locked: string;
  total: string;
  lastSyncAt: Date;
};

type WalletSyncLog = {
  id: string;
  userId: string;
  type: string;
  status: string;
  message?: string | null;
  startedAt: Date;
  finishedAt?: Date | null;
  createdAt: Date;
};

const cuid = () => 'test_' + Math.random().toString(36).slice(2);

export function createPrismaStub() {
  const creds: ExchangeCredential[] = [];
  const balances: WalletBalance[] = [];
  const logs: WalletSyncLog[] = [];

  return {
    // Simula prisma.exchangeCredential
    exchangeCredential: {
      upsert: ({ where, create, update, select }: any) => {
        const key =
          where.userId_exchange.userId + '|' + where.userId_exchange.exchange;
        let row: ExchangeCredential | null =
          creds.find((c) => c.userId + '|' + c.exchange === key) ?? null;
        if (!row) {
          row = {
            id: cuid(),
            status: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...create,
          };
          creds.push(row!);
        } else {
          Object.assign(row, update);
          row.updatedAt = new Date();
        }
        // select safe
        return select
          ? {
              id: row!.id,
              userId: row!.userId,
              exchange: row!.exchange,
              status: row!.status,
              createdAt: row!.createdAt,
              updatedAt: row!.updatedAt,
            }
          : row;
      },
      findUnique: ({ where }: any) => {
        const key =
          where.userId_exchange.userId + '|' + where.userId_exchange.exchange;
        return creds.find((c) => c.userId + '|' + c.exchange === key) || null;
      },
    },

    walletBalance: {
      upsert: ({ where, create, update }: any) => {
        const key = where.userId_asset.userId + '|' + where.userId_asset.asset;
        let row = balances.find((b) => b.userId + '|' + b.asset === key);
        if (!row) {
          row = {
            ...create,
            free: create.free.toString?.() ?? String(create.free),
            locked: create.locked.toString?.() ?? String(create.locked),
            total: create.total.toString?.() ?? String(create.total),
          };
          balances.push(row!);
        } else {
          row.free = update.free.toString?.() ?? String(update.free);
          row.locked = update.locked.toString?.() ?? String(update.locked);
          row.total = update.total.toString?.() ?? String(update.total);
          row.lastSyncAt = new Date();
        }
        return row;
      },
      findMany: ({ where, take, skip, select }: any) => {
        let rows = balances.filter((b) => b.userId === where.userId);
        if (where.asset) rows = rows.filter((b) => b.asset === where.asset);
        if (where.total?.gt != null) {
          const min = Number(where.total.gt);
          rows = rows.filter((b) => Number(b.total) > min);
        }
        rows.sort(
          (a, b) =>
            Number(b.total) - Number(a.total) || a.asset.localeCompare(b.asset),
        );
        rows = rows.slice(skip ?? 0, (skip ?? 0) + (take ?? rows.length));
        if (select) {
          return rows.map((r) => ({
            asset: r.asset,
            free: r.free,
            locked: r.locked,
            total: r.total,
            lastSyncAt: r.lastSyncAt,
          }));
        }
        return rows;
      },
    },

    walletSyncLog: {
      create: ({ data }: any) => {
        const row: WalletSyncLog = {
          id: cuid(),
          createdAt: new Date(),
          ...data,
        };
        logs.push(row);
        return row;
      },
      update: ({ where, data }: any) => {
        const row = logs.find((l) => l.id === where.id);
        if (!row) throw new Error('Log not found');
        Object.assign(row, data);
        return row;
      },
      findMany: () => logs,
    },

    $transaction: async (work: any) => {
      if (typeof work === 'function') {
        return work(createPrismaStub() as any); // simplificado; para nossos testes não é crítico
      }
      // array de promises
      return Promise.all(work);
    },
  };
}
