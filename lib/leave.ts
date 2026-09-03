export function calculateWorkingDays(startDateStr: string, endDateStr: string, workingDays: number[], holidays: string[]): number {
  const start = new Date(startDateStr)
  const end = new Date(endDateStr)
  let days = 0
  let current = new Date(start)
  const holidaySet = new Set(holidays)
  
  while (current <= end) {
    const dayOfWeek = current.getDay()
    const localDateStr = new Date(current.getTime() - (current.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
    
    if (workingDays.includes(dayOfWeek) && !holidaySet.has(localDateStr)) {
      days++
    }
    current.setDate(current.getDate() + 1)
  }
  return days
}
