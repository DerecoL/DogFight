const DATABASE_ERROR_MESSAGE = 'Database is not ready. Check DATABASE_URL and start PostgreSQL.'

export function publicErrorMessage(error: Error & { statusCode?: number }) {
  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return error.message
  }

  const message = error.message || ''
  if (
    message.includes('Invalid `prisma.') ||
    message.includes("Can't reach database server") ||
    message.includes('Error validating datasource')
  ) {
    return DATABASE_ERROR_MESSAGE
  }

  return 'Server error'
}
