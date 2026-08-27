#!/bin/bash
# Post-incidente 20-jul-2026: nada de servicios expuestos a internet.
# Bloquea en DOCKER-USER (docker se salta ufw) todo puerto publicado, en la
# interfaz publica. Acceso remoto = tunel SSH. Si algun dia se quieren
# dominios+TLS, quitar 80/443 de la lista conscientemente.
PUBIF=$(ip route get 1.1.1.1 2>/dev/null | grep -oP "dev \K\S+" | head -1)
for p in 3000 4000 4320 8765 6333; do
  iptables  -C DOCKER-USER -i "$PUBIF" -p tcp --dport $p -j DROP 2>/dev/null || iptables  -I DOCKER-USER -i "$PUBIF" -p tcp --dport $p -j DROP
  ip6tables -C DOCKER-USER -i "$PUBIF" -p tcp --dport $p -j DROP 2>/dev/null || ip6tables -I DOCKER-USER -i "$PUBIF" -p tcp --dport $p -j DROP 2>/dev/null || true
done
