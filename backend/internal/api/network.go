package api

import (
	"encoding/json"
	"net/http"

	"github.com/ullashroy/poco-server/backend/internal/network"
	"github.com/ullashroy/poco-server/backend/internal/state"
)

func NetworkHandler(st *state.State) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		JSON(w, http.StatusOK, st.Network())
	}
}

func NetworkSpeedTestHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, err := network.RunSpeedTest()
		if err != nil {
			JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		JSON(w, http.StatusOK, res)
	}
}

func NetworkWifiScanHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		aps, err := network.ScanWifiAPs()
		if err != nil {
			JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		JSON(w, http.StatusOK, aps)
	}
}

func NetworkWifiConnectHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req network.ConnectWifiRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			JSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request payload"})
			return
		}

		if err := network.ConnectWifi(req); err != nil {
			JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		JSON(w, http.StatusOK, map[string]string{"status": "connected", "ssid": req.SSID})
	}
}

func NetworkWifiDisconnectHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		iface := r.URL.Query().Get("iface")
		if err := network.DisconnectWifi(iface); err != nil {
			JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		JSON(w, http.StatusOK, map[string]string{"status": "disconnected"})
	}
}
