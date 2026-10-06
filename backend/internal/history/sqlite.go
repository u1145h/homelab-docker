package history

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

type sqliteRepository struct {
	db *sql.DB
}

func NewSQLiteRepository(path string) (*sqliteRepository, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("failed to open history database: %w", err)
	}

	if _, err := db.Exec(`PRAGMA journal_mode=WAL`); err != nil {
		return nil, fmt.Errorf("failed to set WAL mode: %w", err)
	}

	if _, err := db.Exec(`PRAGMA synchronous=NORMAL`); err != nil {
		return nil, fmt.Errorf("failed to set synchronous mode: %w", err)
	}

	if err := migrate(db); err != nil {
		return nil, fmt.Errorf("failed to migrate history database: %w", err)
	}

	return &sqliteRepository{db: db}, nil
}

func migrate(db *sql.DB) error {
	query := `CREATE TABLE IF NOT EXISTS samples (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		timestamp TEXT NOT NULL,
		hostname TEXT NOT NULL,
		cpu_usage_percent REAL,
		cpu_logical_cores INTEGER,
		cpu_frequency_mhz REAL,
		memory_total INTEGER,
		memory_used INTEGER,
		memory_available INTEGER,
		memory_usage_percent REAL,
		storage_total INTEGER,
		storage_used INTEGER,
		storage_available INTEGER,
		storage_usage_percent REAL,
		network_rx_bytes INTEGER,
		network_tx_bytes INTEGER,
		battery_present INTEGER,
		battery_capacity REAL,
		battery_status TEXT,
		temperature_max REAL
	)`

	if _, err := db.Exec(query); err != nil {
		return err
	}

	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_samples_timestamp ON samples(timestamp)`); err != nil {
		return err
	}

	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_samples_hostname ON samples(hostname)`); err != nil {
		return err
	}

	return nil
}

func (r *sqliteRepository) Store(sample *Sample) error {
	query := `INSERT INTO samples (
		timestamp, hostname,
		cpu_usage_percent, cpu_logical_cores, cpu_frequency_mhz,
		memory_total, memory_used, memory_available, memory_usage_percent,
		storage_total, storage_used, storage_available, storage_usage_percent,
		network_rx_bytes, network_tx_bytes,
		battery_present, battery_capacity, battery_status,
		temperature_max
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := r.db.Exec(query,
		sample.Timestamp.UTC().Format(time.RFC3339),
		sample.Hostname,
		nullFloat(sample.CPU.UsagePercent),
		nullInt(sample.CPU.LogicalCores),
		nullFloat(sample.CPU.FrequencyMHz),
		nullInt64(sample.Memory.Total),
		nullInt64(sample.Memory.Used),
		nullInt64(sample.Memory.Available),
		nullFloat(sample.Memory.UsagePercent),
		nullInt64(sample.Storage.Total),
		nullInt64(sample.Storage.Used),
		nullInt64(sample.Storage.Available),
		nullFloat(sample.Storage.UsagePercent),
		nullInt64(sample.Network.RXBytes),
		nullInt64(sample.Network.TXBytes),
		nullBool(sample.Battery.Present),
		nullFloat(sample.Battery.Capacity),
		nullString(sample.Battery.Status),
		nullFloat(sample.Thermal.TemperatureMax),
	)
	return err
}

func (r *sqliteRepository) Query(filter QueryFilter) ([]Sample, error) {
	limit := filter.Limit
	if limit <= 0 {
		limit = defaultLimit
	}
	if limit > 10000 {
		limit = 10000
	}

	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	query := `SELECT
		timestamp, hostname,
		cpu_usage_percent, cpu_logical_cores, cpu_frequency_mhz,
		memory_total, memory_used, memory_available, memory_usage_percent,
		storage_total, storage_used, storage_available, storage_usage_percent,
		network_rx_bytes, network_tx_bytes,
		battery_present, battery_capacity, battery_status,
		temperature_max
	FROM samples
	WHERE timestamp >= ? AND timestamp <= ?
	ORDER BY timestamp ASC
	LIMIT ? OFFSET ?`

	rows, err := r.db.Query(query,
		filter.Start.UTC().Format(time.RFC3339),
		filter.End.UTC().Format(time.RFC3339),
		limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var samples []Sample
	for rows.Next() {
		var s Sample
		var ts, hostname string
		var cpuUsage, cpuFreq, memUsage, storUsage, battCap, tempMax sql.NullFloat64
		var cpuCores sql.NullInt64
		var memTot, memUsed, memAvail, storTot, storUsed, storAvail sql.NullInt64
		var netRX, netTX sql.NullInt64
		var battPresent sql.NullBool
		var battStatus sql.NullString

		err := rows.Scan(
			&ts, &hostname,
			&cpuUsage, &cpuCores, &cpuFreq,
			&memTot, &memUsed, &memAvail, &memUsage,
			&storTot, &storUsed, &storAvail, &storUsage,
			&netRX, &netTX,
			&battPresent, &battCap, &battStatus,
			&tempMax,
		)
		if err != nil {
			return nil, err
		}

		s.Timestamp, _ = time.Parse(time.RFC3339, ts)
		s.Hostname = hostname

		if cpuUsage.Valid {
			s.CPU.UsagePercent = cpuUsage.Float64
		}
		if cpuCores.Valid {
			s.CPU.LogicalCores = int(cpuCores.Int64)
		}
		if cpuFreq.Valid {
			s.CPU.FrequencyMHz = cpuFreq.Float64
		}

		if memTot.Valid {
			s.Memory.Total = memTot.Int64
		}
		if memUsed.Valid {
			s.Memory.Used = memUsed.Int64
		}
		if memAvail.Valid {
			s.Memory.Available = memAvail.Int64
		}
		if memUsage.Valid {
			s.Memory.UsagePercent = memUsage.Float64
		}

		if storTot.Valid {
			s.Storage.Total = storTot.Int64
		}
		if storUsed.Valid {
			s.Storage.Used = storUsed.Int64
		}
		if storAvail.Valid {
			s.Storage.Available = storAvail.Int64
		}
		if storUsage.Valid {
			s.Storage.UsagePercent = storUsage.Float64
		}

		if netRX.Valid {
			s.Network.RXBytes = netRX.Int64
		}
		if netTX.Valid {
			s.Network.TXBytes = netTX.Int64
		}

		if battPresent.Valid {
			s.Battery.Present = battPresent.Bool
		}
		if battCap.Valid {
			s.Battery.Capacity = battCap.Float64
		}
		if battStatus.Valid {
			s.Battery.Status = battStatus.String
		}

		if tempMax.Valid {
			s.Thermal.TemperatureMax = tempMax.Float64
		}

		samples = append(samples, s)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if samples == nil {
		samples = []Sample{}
	}

	return samples, nil
}

func (r *sqliteRepository) GetLatest() (*Sample, error) {
	query := `SELECT
		timestamp, hostname,
		cpu_usage_percent, cpu_logical_cores, cpu_frequency_mhz,
		memory_total, memory_used, memory_available, memory_usage_percent,
		storage_total, storage_used, storage_available, storage_usage_percent,
		network_rx_bytes, network_tx_bytes,
		battery_present, battery_capacity, battery_status,
		temperature_max
	FROM samples
	ORDER BY timestamp DESC
	LIMIT 1`

	var s Sample
	var ts, hostname string
	var cpuUsage, cpuFreq, memUsage, storUsage, battCap, tempMax sql.NullFloat64
	var cpuCores sql.NullInt64
	var memTot, memUsed, memAvail, storTot, storUsed, storAvail sql.NullInt64
	var netRX, netTX sql.NullInt64
	var battPresent sql.NullBool
	var battStatus sql.NullString

	err := r.db.QueryRow(query).Scan(
		&ts, &hostname,
		&cpuUsage, &cpuCores, &cpuFreq,
		&memTot, &memUsed, &memAvail, &memUsage,
		&storTot, &storUsed, &storAvail, &storUsage,
		&netRX, &netTX,
		&battPresent, &battCap, &battStatus,
		&tempMax,
	)
	if err == sql.ErrNoRows {
		return nil, ErrNoSamples
	}
	if err != nil {
		return nil, err
	}

	s.Timestamp, _ = time.Parse(time.RFC3339, ts)
	s.Hostname = hostname

	if cpuUsage.Valid {
		s.CPU.UsagePercent = cpuUsage.Float64
	}
	if cpuCores.Valid {
		s.CPU.LogicalCores = int(cpuCores.Int64)
	}
	if cpuFreq.Valid {
		s.CPU.FrequencyMHz = cpuFreq.Float64
	}
	if memTot.Valid {
		s.Memory.Total = memTot.Int64
	}
	if memUsed.Valid {
		s.Memory.Used = memUsed.Int64
	}
	if memAvail.Valid {
		s.Memory.Available = memAvail.Int64
	}
	if memUsage.Valid {
		s.Memory.UsagePercent = memUsage.Float64
	}
	if storTot.Valid {
		s.Storage.Total = storTot.Int64
	}
	if storUsed.Valid {
		s.Storage.Used = storUsed.Int64
	}
	if storAvail.Valid {
		s.Storage.Available = storAvail.Int64
	}
	if storUsage.Valid {
		s.Storage.UsagePercent = storUsage.Float64
	}
	if netRX.Valid {
		s.Network.RXBytes = netRX.Int64
	}
	if netTX.Valid {
		s.Network.TXBytes = netTX.Int64
	}
	if battPresent.Valid {
		s.Battery.Present = battPresent.Bool
	}
	if battCap.Valid {
		s.Battery.Capacity = battCap.Float64
	}
	if battStatus.Valid {
		s.Battery.Status = battStatus.String
	}
	if tempMax.Valid {
		s.Thermal.TemperatureMax = tempMax.Float64
	}

	return &s, nil
}

func (r *sqliteRepository) DeleteBefore(before time.Time) (int64, error) {
	query := `DELETE FROM samples WHERE timestamp < ?`
	result, err := r.db.Exec(query, before.UTC().Format(time.RFC3339))
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func (r *sqliteRepository) Close() error {
	return r.db.Close()
}

func nullFloat(v float64) any {
	if v == 0 {
		return nil
	}
	return v
}

func nullInt(v int) any {
	if v == 0 {
		return nil
	}
	return v
}

func nullInt64(v int64) any {
	if v == 0 {
		return nil
	}
	return v
}

func nullBool(v bool) any {
	if !v {
		return nil
	}
	return 1
}

func nullString(v string) any {
	if v == "" {
		return nil
	}
	return v
}
