CREATE TABLE IF NOT EXISTS `collaborator_photos` (
	`email` varchar(320) NOT NULL,
	`mime` varchar(32) NOT NULL,
	`data` mediumtext NOT NULL,
	`updatedBy` varchar(320),
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collaborator_photos_email` PRIMARY KEY(`email`)
);
