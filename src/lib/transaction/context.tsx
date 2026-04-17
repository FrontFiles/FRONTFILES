'use client'

/**
 * Frontfiles — Transaction Flow Context
 *
 * Global client-side state for the cart → review → pay → finalize → deliver cycle.
 * Wraps the transaction reducer in a React context for cross-page access.
 */

import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react'
import { SESSION_DEMO_USER_ID } from '@/data/users'
import { transactionReducer, createInitialState, centsToEur } from './reducer'
import type { TransactionFlowState, CartItem, TransactionFlowPhase } from './types'
import type { TransactionAction } from './reducer'
import type { LicenceMedium } from '@/lib/documents/types'

// ══════════════════════════════════════════════
// CONTEXT SHAPE
// ══════════════════════════════════════════════

interface TransactionContextValue {
  state: TransactionFlowState
  dispatch: (action: TransactionAction) => void

  // Convenience helpers
  addToCart: (item: Omit<CartItem, 'id' | 'lineSubtotalCents' | 'addedAt' | 'licenceName' | 'licenceType'>) => void
  removeFromCart: (itemId: string) => void
  updateMedium: (itemId: string, medium: LicenceMedium) => void
  clearCart: () => void
  cartItemCount: number
  isInCart: (assetId: string) => boolean
}

const TransactionContext = createContext<TransactionContextValue | null>(null)

// ══════════════════════════════════════════════
// PROVIDER
// ══════════════════════════════════════════════

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    transactionReducer,
    SESSION_DEMO_USER_ID,
    createInitialState,
  )

  const addToCart = useCallback((item: Omit<CartItem, 'id' | 'lineSubtotalCents' | 'addedAt' | 'licenceName' | 'licenceType'>) => {
    dispatch({ type: 'ADD_TO_CART', payload: item })
  }, [])

  const removeFromCart = useCallback((itemId: string) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: { itemId } })
  }, [])

  const updateMedium = useCallback((itemId: string, medium: LicenceMedium) => {
    dispatch({ type: 'UPDATE_MEDIUM', payload: { itemId, medium } })
  }, [])

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' })
  }, [])

  const cartItemCount = state.cart.items.length

  const isInCart = useCallback((assetId: string) => {
    return state.cart.items.some(i => i.assetId === assetId)
  }, [state.cart.items])

  return (
    <TransactionContext.Provider
      value={{ state, dispatch, addToCart, removeFromCart, updateMedium, clearCart, cartItemCount, isInCart }}
    >
      {children}
    </TransactionContext.Provider>
  )
}

// ══════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════

export function useTransaction(): TransactionContextValue {
  const ctx = useContext(TransactionContext)
  if (!ctx) throw new Error('useTransaction must be used within <TransactionProvider>')
  return ctx
}
