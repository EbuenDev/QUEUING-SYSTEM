-- Migration: Add YAKAP Prescriptions Table for RHU II
CREATE TABLE IF NOT EXISTS yakap_prescriptions (
    id VARCHAR(50) PRIMARY KEY,
    rx_number VARCHAR(50) NOT NULL UNIQUE,
    patient_id VARCHAR(50),
    patient_name VARCHAR(255) NOT NULL,
    patient_age INTEGER,
    patient_sex VARCHAR(20),
    patient_address VARCHAR(255),
    phil_health_id VARCHAR(50),
    patient_classification VARCHAR(30) DEFAULT 'regular',
    diagnosis TEXT,
    clinical_notes TEXT,
    medications TEXT NOT NULL DEFAULT '[]',
    doctor_name VARCHAR(255) DEFAULT 'Doc. Renz Sale, MD',
    doctor_prc VARCHAR(50) DEFAULT 'PRC No. 0148921',
    doctor_ptr VARCHAR(50) DEFAULT 'PTR No. 8392104',
    doctor_s2 VARCHAR(50),
    status VARCHAR(30) DEFAULT 'active',
    dispensed_at TIMESTAMP,
    dispensed_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_yakap_prescriptions_rx ON yakap_prescriptions(rx_number);
CREATE INDEX IF NOT EXISTS idx_yakap_prescriptions_patient ON yakap_prescriptions(patient_name);
CREATE INDEX IF NOT EXISTS idx_yakap_prescriptions_status ON yakap_prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_yakap_prescriptions_created ON yakap_prescriptions(created_at);
