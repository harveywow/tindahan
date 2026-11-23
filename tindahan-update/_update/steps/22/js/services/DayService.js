/**
 * @file Opening the store day and answering "is the store open?".
 * Depends on: core/AppError.js, core/EventBus.js, models/DayRecord.js, utils/ids.js,
 * utils/money.js, utils/validators.js.
 *
 * Why sales belong to the OPEN DAY rather than the calendar date: a store
 * opened at 6 AM may still be selling at 12:15 AM. That late sale is part of
 * the same drawer and the same cash count, so it must carry the open day's
 * key even though the calendar already says tomorrow.
 */
import { ConflictError, StoreClosedError } from '../core/AppError.js';
import { EVENTS } from '../core/EventBus.js';
import { createDayRecord, DAY_STATUS } from '../models/DayRecord.js';
import { nowIso } from '../utils/ids.js';
import { formatPeso } from '../utils/money.js';
import { requireMoney } from '../utils/validators.js';

export class DayService {
  /**
   * @param {Object} deps
   * @param {import('../core/Repository.js').Repository} deps.dayRepository
   * @param {import('../core/Clock.js').Clock} deps.clock
   * @param {import('../core/EventBus.js').EventBus} deps.bus
   * @param {import('./LogService.js').LogService} deps.logService
   */
  constructor({ dayRepository, clock, bus, logService }) {
    this.repository = dayRepository;
    this.clock = clock;
    this.bus = bus;
    this.logService = logService;
  }

  /** @returns {import('../models/DayRecord.js').DayRecord|undefined} The day currently open, if any. */
  getOpenDay() {
    return this.repository.getAll().find((record) => record.status === DAY_STATUS.OPEN);
  }

  /** @returns {import('../models/DayRecord.js').DayRecord|undefined} Record for today's date. */
  getTodayRecord() {
    return this.repository.findById(this.clock.today());
  }

  /** @returns {boolean} */
  isOpen() {
    return Boolean(this.getOpenDay());
  }

  /**
   * @returns {import('../models/DayRecord.js').DayRecord} The open day.
   * @throws {StoreClosedError} When no day is open (not yet opened, or already closed).
   */
  assertOpen() {
    const openDay = this.getOpenDay();
    if (!openDay) {
      const todayRecord = this.getTodayRecord();
      const key =
        todayRecord?.status === DAY_STATUS.CLOSED
          ? 'errors.storeClosedToday'
          : 'errors.storeNotOpen';
      throw new StoreClosedError(key);
    }
    return openDay;
  }

  /**
   * Opens today with the cash already in the drawer.
   * @param {string|number} openingCashInput
   * @returns {import('../models/DayRecord.js').DayRecord}
   * @throws {ConflictError} When a day is still open or today was already closed.
   * @throws {import('../core/AppError.js').ValidationError}
   */
  openDay(openingCashInput) {
    if (this.getOpenDay()) {
      throw new ConflictError('errors.dayStillOpen');
    }
    if (this.getTodayRecord()) {
      throw new ConflictError('errors.storeClosedToday');
    }
    const openingCash = requireMoney(openingCashInput, 'openingCash', {
      allowZero: true,
      mustBePayable: true,
    });
    const record = this.repository.upsert(createDayRecord(this.clock.today(), openingCash));
    this.logService.record('day', 'log.dayOpened', { date: record.id });
    this.bus.emit(EVENTS.DAY_CHANGED, record);
    this.bus.emit(EVENTS.DATA_CHANGED, { source: 'day' });
    return record;
  }

  /**
   * Opens today again after it was closed (closed by mistake, or a customer
   * came back). Sales keep counting toward the same day and drawer, so the
   * owner simply counts the drawer again at the next closing. The earlier
   * count is kept on the record and written to the activity log.
   * Only TODAY can be reopened: past days stay final, like printed reports.
   * @returns {import('../models/DayRecord.js').DayRecord}
   * @throws {ConflictError} When a day is open, or today has not been closed.
   */
  reopenToday() {
    if (this.getOpenDay()) {
      throw new ConflictError('errors.dayStillOpen');
    }
    const record = this.getTodayRecord();
    if (record?.status !== DAY_STATUS.CLOSED) {
      throw new ConflictError('errors.nothingToReopen');
    }
    const { closedAt, countedCash, expectedCash, difference, closingNote } = record;
    const reopened = this.repository.upsert({
      ...record,
      status: DAY_STATUS.OPEN,
      reopenCount: (record.reopenCount ?? 0) + 1,
      previousClosings: [
        ...(record.previousClosings ?? []),
        { closedAt, countedCash, expectedCash, difference, closingNote },
      ],
      reopenedAt: nowIso(),
      closedAt: '',
      cashCount: {},
      countedCash: 0,
      expectedCash: 0,
      difference: 0,
      closingNote: '',
      summary: null,
    });
    this.logService.record('day', 'log.dayReopened', {
      date: record.id,
      counted: formatPeso(countedCash),
      difference: formatPeso(difference),
    });
    this.bus.emit(EVENTS.DAY_CHANGED, reopened);
    this.bus.emit(EVENTS.DATA_CHANGED, { source: 'day' });
    return reopened;
  }

  /**
   * @param {string} dayKey
   * @returns {import('../models/DayRecord.js').DayRecord|undefined}
   */
  getRecord(dayKey) {
    return this.repository.findById(dayKey);
  }

  /** @returns {import('../models/DayRecord.js').DayRecord[]} Closed days, newest first. */
  listClosedDays() {
    return this.repository
      .getAll()
      .filter((record) => record.status === DAY_STATUS.CLOSED)
      .sort((first, second) => second.id.localeCompare(first.id));
  }

  /**
   * Saves a changed record (used by ClosingService).
   * @param {import('../models/DayRecord.js').DayRecord} record
   */
  saveRecord(record) {
    this.repository.upsert(record);
    this.bus.emit(EVENTS.DAY_CHANGED, record);
  }
}
