import {
  deriveRailReceiptState,
  PAYMENT_SETTLE_FAIL_PREFIX,
} from '@/components/rail/deriveRailReceiptState';

const settleFail = { kind: 'fail', label: `${PAYMENT_SETTLE_FAIL_PREFIX} after purchase` };

describe('deriveRailReceiptState', () => {
  it('is loading until the status fetch resolves', () => {
    expect(deriveRailReceiptState(null, [])).toBe('loading');
    expect(deriveRailReceiptState(undefined, undefined)).toBe('loading');
    expect(deriveRailReceiptState({}, [])).toBe('loading');
  });

  it('maps not_found rows to not_found', () => {
    expect(deriveRailReceiptState({ status: 'not_found' }, [])).toBe('not_found');
  });

  it('maps in-progress statuses to buying', () => {
    expect(deriveRailReceiptState({ status: 'settling' }, [])).toBe('buying');
    expect(deriveRailReceiptState({ status: 'broadcasting' }, [])).toBe('buying');
  });

  it('complete + paymentSettled → complete', () => {
    expect(deriveRailReceiptState({ status: 'complete', paymentSettled: true }, [])).toBe(
      'complete',
    );
  });

  it('complete + unsettled + no settle-fail entry → ticket_verified_payment_settling', () => {
    expect(
      deriveRailReceiptState({ status: 'complete', paymentSettled: false }, []),
    ).toBe('ticket_verified_payment_settling');
    // A non-fail trace entry mentioning payment does not trip it.
    expect(
      deriveRailReceiptState({ status: 'complete' }, [
        { kind: 'complete', label: 'Ticket purchased on Base' },
      ]),
    ).toBe('ticket_verified_payment_settling');
  });

  it('complete + settle-fail trace entry → payment_not_collected', () => {
    expect(
      deriveRailReceiptState({ status: 'complete', paymentSettled: false }, [settleFail]),
    ).toBe('payment_not_collected');
  });

  it('only fail-kind entries with the prefix count', () => {
    expect(
      deriveRailReceiptState({ status: 'complete' }, [
        { kind: 'complete', label: `${PAYMENT_SETTLE_FAIL_PREFIX} something` },
      ]),
    ).toBe('ticket_verified_payment_settling');
  });

  it('maps error rows to failed', () => {
    expect(deriveRailReceiptState({ status: 'error', error: 'boom' }, [])).toBe('failed');
  });
});
