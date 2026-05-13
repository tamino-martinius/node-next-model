export class NextModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class FilterError extends NextModelError {}
export class NotFoundError extends NextModelError {}
export class PersistenceError extends NextModelError {}
export class StaleObjectError extends NextModelError {}
export class UnsupportedOperationError extends NextModelError {}
/**
 * Thrown when `Model#save()` (and the higher-level `create` / `update`
 * helpers that go through it) fails validation. The structured per-field
 * payload that lives on the rejected instance's `errors` getter is mirrored
 * onto `.errors` so callers don't need a reference to the instance just to
 * inspect what went wrong.
 *
 * The `.message` is formatted so that test assertions like
 * `expect(p).rejects.toThrow(/name/)` work — it contains every field name
 * that produced a failure plus the first message for that field.
 */
export class ValidationError extends NextModelError {
  errors?: Record<string, string[]>;

  constructor(
    messageOrErrors: string | Record<string, string[]>,
    errors?: Record<string, string[]>,
  ) {
    // Two call shapes are supported for backwards compatibility:
    //   new ValidationError('Validation failed', errorsMap)
    //   new ValidationError(errorsMap)
    // The single-argument form is the new ergonomic one. The message is
    // synthesised from the map so it includes field names.
    let resolvedErrors: Record<string, string[]> | undefined;
    let baseMessage: string;
    if (typeof messageOrErrors === 'string') {
      baseMessage = messageOrErrors;
      resolvedErrors = errors;
    } else {
      resolvedErrors = messageOrErrors;
      baseMessage = 'Validation failed';
    }
    super(ValidationError.formatMessage(baseMessage, resolvedErrors));
    this.errors = resolvedErrors;
  }

  /**
   * Render a human-readable summary of every field failure, prefixed by the
   * base message. Returns just the base message when no field errors are
   * supplied — callers that pass plain strings still get the previous
   * behaviour.
   */
  private static formatMessage(base: string, errors: Record<string, string[]> | undefined): string {
    if (!errors) return base;
    const parts: string[] = [];
    for (const field of Object.keys(errors)) {
      const reasons = errors[field];
      if (!reasons || reasons.length === 0) continue;
      // Show every reason for each field. Joining with `, ` reads naturally
      // for the common one-reason case ("name: cannot be blank") and stays
      // legible when a field has multiple ("name: cannot be blank, must be
      // at least 3 characters").
      parts.push(`${field}: ${reasons.join(', ')}`);
    }
    if (parts.length === 0) return base;
    return `${base}: ${parts.join('; ')}`;
  }
}
