/**
 * Error codes returned by libclang routines.
 *
 * Zero ({@link CXError_Success}) is the only error code indicating success. Other
 * error codes, including not yet assigned non-zero values, indicate errors.
 */
export const enum CXErrorCode {
  /**
   * No error.
   */
  CXError_Success = 0,

  /**
   * A generic error code, no further details are available.
   *
   * Errors of this kind can get their own specific error codes in future
   * libclang versions.
   */
  CXError_Failure = 1,

  /**
   * libclang crashed while performing the requested operation.
   */
  CXError_Crashed = 2,

  /**
   * The function detected that the arguments violate the function
   * contract.
   */
  CXError_InvalidArguments = 3,

  /**
   * An AST deserialization error has occurred.
   */
  CXError_ASTReadError = 4,
}
export const CXErrorCodeT = "u8" as const;

export const throwIfError = (
  errorCode: CXErrorCode,
  baseMessage: string,
): void => {
  if (errorCode === CXErrorCode.CXError_Success) {
    return;
  }
  let err: Error;
  if (errorCode === CXErrorCode.CXError_Failure) {
    err = new Error(
      `${baseMessage}: Unkown error occurred`,
      { cause: errorCode },
    );
  } else if (errorCode === CXErrorCode.CXError_Crashed) {
    err = new Error(`${baseMessage}: libclang crashed`, {
      cause: errorCode,
    });
  } else if (errorCode === CXErrorCode.CXError_InvalidArguments) {
    err = new Error(`${baseMessage}: Invalid arguments`, {
      cause: errorCode,
    });
  } else if (errorCode === CXErrorCode.CXError_ASTReadError) {
    err = new Error(
      `${baseMessage}: AST deserialization error occurred`,
      { cause: errorCode },
    );
  } else {
    err = new Error(`${baseMessage}: Unkown error code`, {
      cause: errorCode,
    });
  }
  if ("captureStackTrace" in Error) {
    Error.captureStackTrace(err, throwIfError);
  }
  throw err;
};
