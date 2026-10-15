import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  // Not every test file runs under jsdom (storage tests use the node environment).
  if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
    localStorage.clear()
  }
})
