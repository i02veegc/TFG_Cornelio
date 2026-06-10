'use client';
import { useEffect, useRef } from 'react';
import { subscribeMqttEvents } from '@/lib/mqttClient';

/**
 * Hook que registra un callback para eventos de venta en tiempo real.
 * El callback recibe (obraId, eventData).
 *
 * El callback se mantiene actualizado en una ref para que el caller pueda
 * pasar un closure inline sin necesidad de useCallback.
 */
export function useObrasLive(onSale) {
  const onSaleRef = useRef(onSale);

  useEffect(() => {
    onSaleRef.current = onSale;
  }, [onSale]);

  useEffect(() => {
    const unsubscribe = subscribeMqttEvents((event) => {
      if (event.type === 'sale' && typeof onSaleRef.current === 'function') {
        onSaleRef.current(event.obraId, event);
      }
    });
    return unsubscribe;
  }, []);
}
