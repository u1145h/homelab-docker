package tailscale

import (
	"encoding/json"
	"os/exec"
)

type Peer struct {
	Hostname string `json:"hostname"`
	IP       string `json:"ip"`
	Online   bool   `json:"online"`
}

type Self struct {
	Hostname string `json:"hostname"`
	IP       string `json:"ip"`
	Online   bool   `json:"online"`
}

type Info struct {
	Version      string `json:"version"`
	BackendState string `json:"backendState"`
	Self         Self   `json:"self"`
	Peers        []Peer `json:"peers"`
}

type statusResponse struct {
	Version      string `json:"Version"`
	BackendState string `json:"BackendState"`

	Self struct {
		HostName     string   `json:"HostName"`
		TailscaleIPs []string `json:"TailscaleIPs"`
		Online       bool     `json:"Online"`
	} `json:"Self"`

	Peer map[string]struct {
		HostName     string   `json:"HostName"`
		TailscaleIPs []string `json:"TailscaleIPs"`
		Online       bool     `json:"Online"`
	} `json:"Peer"`
}

func Collect() (*Info, error) {
	out, err := exec.Command("tailscale", "status", "--json").Output()
	if err != nil {
		return &Info{}, err
	}

	var raw statusResponse

	if err := json.Unmarshal(out, &raw); err != nil {
		return &Info{}, err
	}

	info := &Info{
		Version:      raw.Version,
		BackendState: raw.BackendState,
	}

	info.Self.Hostname = raw.Self.HostName
	info.Self.Online = raw.Self.Online

	if len(raw.Self.TailscaleIPs) > 0 {
		info.Self.IP = raw.Self.TailscaleIPs[0]
	}

	for _, p := range raw.Peer {

		peer := Peer{
			Hostname: p.HostName,
			Online:   p.Online,
		}

		if len(p.TailscaleIPs) > 0 {
			peer.IP = p.TailscaleIPs[0]
		}

		info.Peers = append(info.Peers, peer)
	}

	return info, nil
}
