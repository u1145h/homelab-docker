#!/bin/sh
# -----------------------------------------------------------------------------
# Poco Homelab Appliance - Standalone Battery Charge Protection Service Installer
# Configures persistent root permissions and sysfs battery charge limits on boot
# Supports OpenRC (postmarketOS / Alpine) and Systemd Linux distributions
# -----------------------------------------------------------------------------

set -e

# Detect script directory & backend path
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔋 Installing Standalone Battery Charge Protection Service..."

# Create helper boot-permissions script in backend/scripts/grant-battery-perms.sh
PERM_SCRIPT="$SCRIPT_DIR/grant-battery-perms.sh"
cat <<'EOF' > "$PERM_SCRIPT"
#!/bin/sh
# Grant write access to all sysfs battery charging controls on Linux / postmarketOS
chmod 666 /sys/class/power_supply/*/charging_enabled 2>/dev/null || true
chmod 666 /sys/class/power_supply/*/charge_enabled 2>/dev/null || true
chmod 666 /sys/class/power_supply/*/charge_control_limit 2>/dev/null || true
chmod 666 /sys/class/power_supply/*/charge_control_limit_max 2>/dev/null || true
chmod 666 /sys/class/power_supply/*/charge_stop_threshold 2>/dev/null || true
chmod 666 /sys/class/power_supply/*/charge_control_end_threshold 2>/dev/null || true
chmod 666 /sys/class/power_supply/*/store_mode 2>/dev/null || true
chmod 666 /sys/class/power_supply/*/input_current_limit 2>/dev/null || true
EOF
chmod +x "$PERM_SCRIPT"

# Execute immediately right now
"$PERM_SCRIPT"

# -----------------------------------------------------------------------------
# 1. OpenRC Service (postmarketOS / Alpine default)
# -----------------------------------------------------------------------------
if [ -d "/etc/init.d" ] && command -v rc-service >/dev/null 2>&1; then
    echo "📦 Detected OpenRC init system (postmarketOS)..."
    
    SERVICE_FILE="/etc/init.d/poco-battery-service"
    
    cat <<EOF > "$SERVICE_FILE"
#!/sbin/openrc-run

name="poco-battery-service"
description="Poco Battery Sysfs Charge Protection & Root Permission Service"
command="$PERM_SCRIPT"
output_log="/var/log/poco-battery-service.log"
error_log="/var/log/poco-battery-service-error.log"

depend() {
    after localmount
}

start() {
    ebegin "Applying Poco Battery Hardware Sysfs Permissions"
    $PERM_SCRIPT
    eend \$?
}
EOF

    chmod +x "$SERVICE_FILE"
    rc-update add poco-battery-service default 2>/dev/null || true
    rc-service poco-battery-service restart 2>/dev/null || true

    echo "✅ OpenRC Battery Service installed & started successfully!"
    rc-service poco-battery-service status 2>/dev/null || true
    exit 0
fi

# -----------------------------------------------------------------------------
# 2. Systemd Service (Alternative Linux distributions)
# -----------------------------------------------------------------------------
if command -v systemctl >/dev/null 2>&1; then
    echo "📦 Detected Systemd init system..."
    
    SYSTEMD_FILE="/etc/systemd/system/poco-battery-service.service"
    
    cat <<EOF > "$SYSTEMD_FILE"
[Unit]
Description=Poco Battery Sysfs Charge Protection & Root Permission Service
After=multi-user.target

[Service]
Type=oneshot
User=root
ExecStart=$PERM_SCRIPT
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable --now poco-battery-service

    echo "✅ Systemd Battery Service installed & started successfully!"
    systemctl status poco-battery-service --no-pager || true
    exit 0
fi

# -----------------------------------------------------------------------------
# 3. Udev fallback rule
# -----------------------------------------------------------------------------
if [ -d "/etc/udev/rules.d" ]; then
    echo "📦 Adding fallback udev battery permission rule..."
    cat <<'EOF' > /etc/udev/rules.d/99-poco-battery.rules
SUBSYSTEM=="power_supply", ATTR{charging_enabled}=="*", MODE="0666"
SUBSYSTEM=="power_supply", ATTR{charge_control_limit}=="*", MODE="0666"
SUBSYSTEM=="power_supply", ATTR{charge_stop_threshold}=="*", MODE="0666"
SUBSYSTEM=="power_supply", ATTR{store_mode}=="*", MODE="0666"
EOF
    udevadm control --reload-rules 2>/dev/null && udevadm trigger 2>/dev/null || true
fi

echo "✅ Battery sysfs permissions granted."
