# 1-core: Open5GS 5G SA Core

## IMPORTANT: We do NOT deploy custom configs.

The `setup.sh` script simply:
1. Installs Open5GS from PPA (`apt install open5gs`)
2. Starts MongoDB
3. Starts all Open5GS systemd services with **DEFAULT configs**

The default configs that ship with the package are correct and complete.
No custom YAML files are needed. This avoids all IP address conflicts.

If you previously had broken configs, restore defaults:
```bash
sudo apt install --reinstall open5gs
sudo systemctl restart open5gs-*
```
