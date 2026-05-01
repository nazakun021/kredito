import { rpc } from '@stellar/stellar-sdk';
import { rpcServer } from './client';
import { sleep } from '../utils/sleep';
import { parseLedgerRange } from '../lib/parseLedgerRange';

async function withRetry<T>(fn: () => Promise<T>, retries = 3, backoffMs = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(backoffMs * 2 ** i);
    }
  }
  throw new Error('unreachable');
}

export async function paginateEvents(
  filters: rpc.Api.EventFilter[],
  requestedStartLedger: number,
  limit = 200,
) {
  let cursor: string | undefined;
  let events: rpc.Api.EventResponse[] = [];
  let oldestLedger: number | undefined;

  while (true) {
    const request: rpc.Api.GetEventsRequest = cursor
      ? { filters, cursor, limit }
      : { filters, startLedger: requestedStartLedger, limit };

    let page: rpc.Api.GetEventsResponse;
    try {
      page = await withRetry(() => rpcServer.getEvents(request));
    } catch (error) {
      if (cursor) {
        throw error;
      }

      const range = parseLedgerRange(error);
      if (!range) {
        throw error;
      }

      page = await withRetry(() =>
        rpcServer.getEvents({
          filters,
          startLedger: Math.max(range.min, Math.min(requestedStartLedger, range.max)),
          limit,
        }),
      );
    }

    oldestLedger = page.oldestLedger;
    events = events.concat(page.events);

    if (page.events.length < limit || page.cursor === cursor) {
      break;
    }

    cursor = page.cursor;
  }

  return {
    events,
    oldestLedger: oldestLedger ?? requestedStartLedger,
  };
}
