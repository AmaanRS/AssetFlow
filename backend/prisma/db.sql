SET FOREIGN_KEY_CHECKS = 0;

-- CreateTable
CREATE TABLE
    `users` (
        `user_id` INTEGER NOT NULL AUTO_INCREMENT,
        `name` TEXT NOT NULL,
        `email` TEXT NOT NULL,
        `password_hash` TEXT NOT NULL,
        `role` TEXT NOT NULL,
        `department_id` INTEGER NULL,
        `session_version` INTEGER NOT NULL DEFAULT 0,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`department_id`) REFERENCES `departments` (`department_id`) ON DELETE SET NULL ON UPDATE CASCADE,
        PRIMARY KEY (`user_id`)
    );

-- CreateTable
CREATE TABLE
    `password_reset_tokens` (
        `password_reset_token_id` INTEGER NOT NULL AUTO_INCREMENT,
        `user_id` INTEGER NOT NULL,
        `token_hash` TEXT NOT NULL,
        `expires_at` DATETIME NOT NULL,
        `used_at` DATETIME NULL,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
        PRIMARY KEY (`password_reset_token_id`)
    );

-- CreateTable
CREATE TABLE
    `departments` (
        `department_id` INTEGER NOT NULL AUTO_INCREMENT,
        `name` TEXT NOT NULL,
        `description` TEXT NULL,
        `head_user_id` INTEGER NULL,
        FOREIGN KEY (`head_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
        PRIMARY KEY (`department_id`)
    );

-- CreateTable
CREATE TABLE
    `asset_categories` (
        `category_id` INTEGER NOT NULL AUTO_INCREMENT,
        `name` TEXT NOT NULL,
        `description` TEXT NULL,
        PRIMARY KEY (`category_id`)
    );

-- CreateTable
CREATE TABLE
    `assets` (
        `asset_id` INTEGER NOT NULL AUTO_INCREMENT,
        `asset_tag` TEXT NOT NULL,
        `name` TEXT NOT NULL,
        `category_id` INTEGER NOT NULL,
        `status` TEXT NOT NULL,
        `is_shared_resource` BOOLEAN NOT NULL DEFAULT false,
        `current_holder_user_id` INTEGER NULL,
        `current_holder_department_id` INTEGER NULL,
        `registered_by` INTEGER NOT NULL,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`category_id`) REFERENCES `asset_categories` (`category_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (`current_holder_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY (`current_holder_department_id`) REFERENCES `departments` (`department_id`) ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY (`registered_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
        PRIMARY KEY (`asset_id`)
    );

-- CreateTable
CREATE TABLE
    `asset_allocations` (
        `allocation_id` INTEGER NOT NULL AUTO_INCREMENT,
        `asset_id` INTEGER NOT NULL,
        `allocated_to_user_id` INTEGER NULL,
        `allocated_to_department_id` INTEGER NULL,
        `allocated_by` INTEGER NOT NULL,
        `allocated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `returned_at` DATETIME NULL,
        `status` TEXT NOT NULL,
        FOREIGN KEY (`asset_id`) REFERENCES `assets` (`asset_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (`allocated_to_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY (`allocated_to_department_id`) REFERENCES `departments` (`department_id`) ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY (`allocated_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
        PRIMARY KEY (`allocation_id`)
    );

-- CreateTable
CREATE TABLE
    `transfer_requests` (
        `transfer_request_id` INTEGER NOT NULL AUTO_INCREMENT,
        `asset_id` INTEGER NOT NULL,
        `from_user_id` INTEGER NULL,
        `from_department_id` INTEGER NULL,
        `to_user_id` INTEGER NULL,
        `to_department_id` INTEGER NULL,
        `requested_by` INTEGER NOT NULL,
        `approved_by` INTEGER NULL,
        `status` TEXT NOT NULL,
        `requested_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `approved_at` DATETIME NULL,
        FOREIGN KEY (`asset_id`) REFERENCES `assets` (`asset_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (`from_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY (`from_department_id`) REFERENCES `departments` (`department_id`) ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY (`to_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY (`to_department_id`) REFERENCES `departments` (`department_id`) ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY (`requested_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
        PRIMARY KEY (`transfer_request_id`)
    );

-- CreateTable
CREATE TABLE
    `bookings` (
        `booking_id` INTEGER NOT NULL AUTO_INCREMENT,
        `asset_id` INTEGER NOT NULL,
        `user_id` INTEGER NOT NULL,
        `start_time` DATETIME NOT NULL,
        `end_time` DATETIME NOT NULL,
        `status` TEXT NOT NULL,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`asset_id`) REFERENCES `assets` (`asset_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
        PRIMARY KEY (`booking_id`)
    );

-- CreateTable
CREATE TABLE
    `maintenance_requests` (
        `maintenance_request_id` INTEGER NOT NULL AUTO_INCREMENT,
        `asset_id` INTEGER NOT NULL,
        `raised_by_user_id` INTEGER NOT NULL,
        `approved_by_user_id` INTEGER NULL,
        `status` TEXT NOT NULL,
        `raised_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `approved_at` DATETIME NULL,
        `work_started_at` DATETIME NULL,
        `work_completed_at` DATETIME NULL,
        FOREIGN KEY (`asset_id`) REFERENCES `assets` (`asset_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (`raised_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (`approved_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
        PRIMARY KEY (`maintenance_request_id`)
    );

-- CreateTable
CREATE TABLE
    `audit_cycles` (
        `audit_cycle_id` INTEGER NOT NULL AUTO_INCREMENT,
        `name` TEXT NOT NULL,
        `start_date` DATE NOT NULL,
        `end_date` DATE NOT NULL,
        `status` TEXT NOT NULL,
        PRIMARY KEY (`audit_cycle_id`)
    );

-- CreateTable
CREATE TABLE
    `audit_assignments` (
        `audit_assignment_id` INTEGER NOT NULL AUTO_INCREMENT,
        `audit_cycle_id` INTEGER NOT NULL,
        `auditor_user_id` INTEGER NOT NULL,
        `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `status` TEXT NOT NULL,
        FOREIGN KEY (`audit_cycle_id`) REFERENCES `audit_cycles` (`audit_cycle_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (`auditor_user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
        PRIMARY KEY (`audit_assignment_id`)
    );

-- CreateTable
CREATE TABLE
    `asset_verifications` (
        `verification_id` INTEGER NOT NULL AUTO_INCREMENT,
        `audit_cycle_id` INTEGER NOT NULL,
        `asset_id` INTEGER NOT NULL,
        `auditor_user_id` INTEGER NOT NULL,
        `verified_status` TEXT NOT NULL,
        `remarks` TEXT NULL,
        `verified_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`audit_cycle_id`) REFERENCES `audit_cycles` (`audit_cycle_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (`asset_id`) REFERENCES `assets` (`asset_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (`auditor_user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
        PRIMARY KEY (`verification_id`)
    );

-- CreateTable
CREATE TABLE
    `discrepancy_reports` (
        `report_id` INTEGER NOT NULL AUTO_INCREMENT,
        `audit_cycle_id` INTEGER NOT NULL,
        `summary` TEXT NOT NULL,
        `status` TEXT NOT NULL,
        `generated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`audit_cycle_id`) REFERENCES `audit_cycles` (`audit_cycle_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
        PRIMARY KEY (`report_id`)
    );

-- CreateTable
CREATE TABLE
    `notifications` (
        `notification_id` INTEGER NOT NULL AUTO_INCREMENT,
        `user_id` INTEGER NOT NULL,
        `type` TEXT NOT NULL,
        `message` TEXT NOT NULL,
        `read_status` BOOLEAN NOT NULL DEFAULT false,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
        PRIMARY KEY (`notification_id`)
    );

-- CreateTable
CREATE TABLE
    `activity_logs` (
        `log_id` INTEGER NOT NULL AUTO_INCREMENT,
        `actor_user_id` INTEGER NOT NULL,
        `action_type` TEXT NOT NULL,
        `entity_type` TEXT NOT NULL,
        `entity_id` INTEGER NOT NULL,
        `details` TEXT NULL,
        `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
        PRIMARY KEY (`log_id`)
    );

SET FOREIGN_KEY_CHECKS = 1;
