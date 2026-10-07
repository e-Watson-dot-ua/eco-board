CREATE TABLE device_readings (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_sn     text        NOT NULL,
    ts            timestamptz NOT NULL DEFAULT now(),
    battery_level smallint,
    power_in      integer,
    power_out     integer,
    temperature   numeric(5, 1),
    raw           jsonb       NOT NULL
);

CREATE INDEX device_readings_device_sn_ts_idx
    ON device_readings (device_sn, ts);
