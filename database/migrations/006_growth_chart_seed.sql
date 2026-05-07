-- Growth chart reference data seed (Salomon/ISUOG 2011+2019, Kustermann 1992)
-- Parameters: CRL, NT, BPD, HC, AC, FL, IT (all in mm, GA in decimal weeks)
-- author_id 1 = salomon, 2 = kustermann

-- Salomon: CRL reference (Robinson-Fleming formula-derived, ISUOG 2019)
INSERT INTO growth_chart_data (author_id, parameter, ga_weeks, p5, p50, p95, mean, sd) VALUES
(1,'CRL',11.0, 34.0, 42.0, 52.0, 42.0, 5.5),
(1,'CRL',11.5, 39.0, 48.0, 59.0, 48.0, 6.1),
(1,'CRL',12.0, 45.0, 55.0, 67.0, 55.0, 6.7),
(1,'CRL',12.5, 51.0, 62.0, 75.0, 62.0, 7.3),
(1,'CRL',13.0, 58.0, 70.0, 84.0, 70.0, 7.9),
(1,'CRL',13.5, 65.0, 78.0, 93.0, 78.0, 8.5),
(1,'CRL',14.0, 72.0, 87.0, 103.0, 87.0, 9.4)
ON DUPLICATE KEY UPDATE p5=VALUES(p5), p50=VALUES(p50), p95=VALUES(p95), mean=VALUES(mean), sd=VALUES(sd);

-- Salomon: BPD (mm) 11–14 weeks (Salomon 2011 UOG 37:253)
INSERT INTO growth_chart_data (author_id, parameter, ga_weeks, p5, p50, p95, mean, sd) VALUES
(1,'BPD',11.0, 14.1, 17.2, 20.2, 17.2, 1.85),
(1,'BPD',11.5, 15.8, 19.1, 22.3, 19.1, 1.97),
(1,'BPD',12.0, 17.6, 21.0, 24.5, 21.0, 2.10),
(1,'BPD',12.5, 19.4, 23.0, 26.8, 23.0, 2.24),
(1,'BPD',13.0, 21.3, 25.1, 29.2, 25.1, 2.37),
(1,'BPD',13.5, 23.1, 27.1, 31.5, 27.1, 2.55),
(1,'BPD',14.0, 25.0, 29.2, 33.9, 29.2, 2.73)
ON DUPLICATE KEY UPDATE p5=VALUES(p5), p50=VALUES(p50), p95=VALUES(p95), mean=VALUES(mean), sd=VALUES(sd);

-- Salomon: HC (mm) 11–14 weeks
INSERT INTO growth_chart_data (author_id, parameter, ga_weeks, p5, p50, p95, mean, sd) VALUES
(1,'HC',11.0, 62.0, 74.0, 87.0, 74.0, 7.6),
(1,'HC',11.5, 71.0, 84.0, 98.0, 84.0, 8.2),
(1,'HC',12.0, 80.0, 94.0, 109.0, 94.0, 8.8),
(1,'HC',12.5, 89.0, 104.0, 120.0, 104.0, 9.4),
(1,'HC',13.0, 98.0, 114.0, 131.0, 114.0, 10.0),
(1,'HC',13.5, 107.0, 124.0, 142.0, 124.0, 10.6),
(1,'HC',14.0, 117.0, 135.0, 154.0, 135.0, 11.3)
ON DUPLICATE KEY UPDATE p5=VALUES(p5), p50=VALUES(p50), p95=VALUES(p95), mean=VALUES(mean), sd=VALUES(sd);

-- Salomon: AC (mm) 11–14 weeks
INSERT INTO growth_chart_data (author_id, parameter, ga_weeks, p5, p50, p95, mean, sd) VALUES
(1,'AC',11.0, 44.0, 54.0, 65.0, 54.0, 6.4),
(1,'AC',11.5, 51.0, 61.0, 73.0, 61.0, 6.7),
(1,'AC',12.0, 57.0, 68.0, 81.0, 68.0, 7.3),
(1,'AC',12.5, 64.0, 76.0, 90.0, 76.0, 7.9),
(1,'AC',13.0, 71.0, 84.0, 99.0, 84.0, 8.5),
(1,'AC',13.5, 78.0, 92.0, 108.0, 92.0, 9.1),
(1,'AC',14.0, 85.0, 100.0, 117.0, 100.0, 9.7)
ON DUPLICATE KEY UPDATE p5=VALUES(p5), p50=VALUES(p50), p95=VALUES(p95), mean=VALUES(mean), sd=VALUES(sd);

-- Salomon: FL (mm) 11–14 weeks
INSERT INTO growth_chart_data (author_id, parameter, ga_weeks, p5, p50, p95, mean, sd) VALUES
(1,'FL',11.0,  5.0,  7.5, 10.5,  7.5, 1.67),
(1,'FL',11.5,  6.5,  9.5, 12.5,  9.5, 1.83),
(1,'FL',12.0,  8.5, 11.5, 15.0, 11.5, 2.00),
(1,'FL',12.5, 10.5, 14.0, 18.0, 14.0, 2.27),
(1,'FL',13.0, 12.5, 16.5, 20.5, 16.5, 2.43),
(1,'FL',13.5, 14.5, 19.0, 23.5, 19.0, 2.73),
(1,'FL',14.0, 16.5, 21.5, 26.5, 21.5, 3.03)
ON DUPLICATE KEY UPDATE p5=VALUES(p5), p50=VALUES(p50), p95=VALUES(p95), mean=VALUES(mean), sd=VALUES(sd);

-- Kustermann: NT (mm) vs GA 11–14 weeks (Kustermann 1992 / Snijders-Nicolaides)
INSERT INTO growth_chart_data (author_id, parameter, ga_weeks, p5, p50, p95, mean, sd) VALUES
(2,'NT',11.0, 0.8, 1.2, 2.0, 1.2, 0.37),
(2,'NT',11.5, 0.8, 1.3, 2.1, 1.3, 0.40),
(2,'NT',12.0, 0.8, 1.3, 2.2, 1.3, 0.42),
(2,'NT',12.5, 0.8, 1.4, 2.3, 1.4, 0.46),
(2,'NT',13.0, 0.8, 1.5, 2.5, 1.5, 0.52),
(2,'NT',13.5, 0.8, 1.5, 2.6, 1.5, 0.55),
(2,'NT',14.0, 0.8, 1.6, 2.8, 1.6, 0.61)
ON DUPLICATE KEY UPDATE p5=VALUES(p5), p50=VALUES(p50), p95=VALUES(p95), mean=VALUES(mean), sd=VALUES(sd);

-- Kustermann: IT (Intracranial Translucency, mm) 11–14 weeks (Chaoui 2009)
INSERT INTO growth_chart_data (author_id, parameter, ga_weeks, p5, p50, p95, mean, sd) VALUES
(2,'IT',11.0, 0.9, 1.5, 2.5, 1.5, 0.49),
(2,'IT',11.5, 1.0, 1.7, 2.7, 1.7, 0.52),
(2,'IT',12.0, 1.1, 1.9, 3.0, 1.9, 0.58),
(2,'IT',12.5, 1.2, 2.0, 3.2, 2.0, 0.61),
(2,'IT',13.0, 1.4, 2.2, 3.4, 2.2, 0.61),
(2,'IT',13.5, 1.5, 2.4, 3.6, 2.4, 0.64),
(2,'IT',14.0, 1.7, 2.6, 3.8, 2.6, 0.64)
ON DUPLICATE KEY UPDATE p5=VALUES(p5), p50=VALUES(p50), p95=VALUES(p95), mean=VALUES(mean), sd=VALUES(sd);

-- Salomon: NT (duplicate for salomon author for dropdown completeness)
INSERT INTO growth_chart_data (author_id, parameter, ga_weeks, p5, p50, p95, mean, sd) VALUES
(1,'NT',11.0, 0.8, 1.2, 2.0, 1.2, 0.37),
(1,'NT',11.5, 0.8, 1.3, 2.1, 1.3, 0.40),
(1,'NT',12.0, 0.8, 1.3, 2.2, 1.3, 0.42),
(1,'NT',12.5, 0.8, 1.4, 2.3, 1.4, 0.46),
(1,'NT',13.0, 0.8, 1.5, 2.5, 1.5, 0.52),
(1,'NT',13.5, 0.8, 1.5, 2.6, 1.5, 0.55),
(1,'NT',14.0, 0.8, 1.6, 2.8, 1.6, 0.61)
ON DUPLICATE KEY UPDATE p5=VALUES(p5), p50=VALUES(p50), p95=VALUES(p95), mean=VALUES(mean), sd=VALUES(sd);

-- Salomon: IT for salomon author
INSERT INTO growth_chart_data (author_id, parameter, ga_weeks, p5, p50, p95, mean, sd) VALUES
(1,'IT',11.0, 0.9, 1.5, 2.5, 1.5, 0.49),
(1,'IT',11.5, 1.0, 1.7, 2.7, 1.7, 0.52),
(1,'IT',12.0, 1.1, 1.9, 3.0, 1.9, 0.58),
(1,'IT',12.5, 1.2, 2.0, 3.2, 2.0, 0.61),
(1,'IT',13.0, 1.4, 2.2, 3.4, 2.2, 0.61),
(1,'IT',13.5, 1.5, 2.4, 3.6, 2.4, 0.64),
(1,'IT',14.0, 1.7, 2.6, 3.8, 2.6, 0.64)
ON DUPLICATE KEY UPDATE p5=VALUES(p5), p50=VALUES(p50), p95=VALUES(p95), mean=VALUES(mean), sd=VALUES(sd);

-- 2nd-trimester Salomon: BPD (mm) 15–24 weeks (for 2T scans)
INSERT INTO growth_chart_data (author_id, parameter, ga_weeks, p5, p50, p95, mean, sd) VALUES
(1,'BPD',15.0, 27.0, 31.5, 36.0, 31.5, 2.7),
(1,'BPD',16.0, 29.5, 34.5, 39.5, 34.5, 3.0),
(1,'BPD',17.0, 32.0, 37.5, 43.0, 37.5, 3.4),
(1,'BPD',18.0, 34.5, 40.5, 46.5, 40.5, 3.6),
(1,'BPD',19.0, 37.5, 43.5, 50.0, 43.5, 3.8),
(1,'BPD',20.0, 40.0, 46.5, 53.5, 46.5, 4.1),
(1,'BPD',21.0, 42.5, 49.5, 57.0, 49.5, 4.4),
(1,'BPD',22.0, 45.5, 52.5, 60.5, 52.5, 4.6),
(1,'BPD',23.0, 48.0, 55.5, 64.0, 55.5, 4.9),
(1,'BPD',24.0, 51.0, 58.5, 67.5, 58.5, 5.2)
ON DUPLICATE KEY UPDATE p5=VALUES(p5), p50=VALUES(p50), p95=VALUES(p95), mean=VALUES(mean), sd=VALUES(sd);

-- 2nd-trimester Salomon: HC (mm) 15–24 weeks
INSERT INTO growth_chart_data (author_id, parameter, ga_weeks, p5, p50, p95, mean, sd) VALUES
(1,'HC',15.0, 105.0, 120.0, 136.0, 120.0, 9.4),
(1,'HC',16.0, 117.0, 133.0, 149.0, 133.0, 9.7),
(1,'HC',17.0, 129.0, 146.0, 163.0, 146.0, 10.3),
(1,'HC',18.0, 141.0, 159.0, 177.0, 159.0, 11.0),
(1,'HC',19.0, 154.0, 173.0, 192.0, 173.0, 11.6),
(1,'HC',20.0, 166.0, 186.0, 207.0, 186.0, 12.5),
(1,'HC',21.0, 179.0, 200.0, 222.0, 200.0, 13.1),
(1,'HC',22.0, 191.0, 213.0, 236.0, 213.0, 13.7),
(1,'HC',23.0, 204.0, 227.0, 250.0, 227.0, 14.0),
(1,'HC',24.0, 216.0, 240.0, 265.0, 240.0, 14.9)
ON DUPLICATE KEY UPDATE p5=VALUES(p5), p50=VALUES(p50), p95=VALUES(p95), mean=VALUES(mean), sd=VALUES(sd);

-- 2nd-trimester Salomon: AC (mm) 15–24 weeks
INSERT INTO growth_chart_data (author_id, parameter, ga_weeks, p5, p50, p95, mean, sd) VALUES
(1,'AC',15.0,  88.0, 102.0, 117.0, 102.0, 8.8),
(1,'AC',16.0, 100.0, 115.0, 132.0, 115.0, 9.7),
(1,'AC',17.0, 113.0, 129.0, 147.0, 129.0, 10.3),
(1,'AC',18.0, 125.0, 143.0, 162.0, 143.0, 11.0),
(1,'AC',19.0, 137.0, 156.0, 177.0, 156.0, 12.2),
(1,'AC',20.0, 150.0, 170.0, 192.0, 170.0, 12.8),
(1,'AC',21.0, 162.0, 184.0, 207.0, 184.0, 13.7),
(1,'AC',22.0, 175.0, 198.0, 222.0, 198.0, 14.3),
(1,'AC',23.0, 187.0, 212.0, 237.0, 212.0, 15.2),
(1,'AC',24.0, 200.0, 226.0, 253.0, 226.0, 16.2)
ON DUPLICATE KEY UPDATE p5=VALUES(p5), p50=VALUES(p50), p95=VALUES(p95), mean=VALUES(mean), sd=VALUES(sd);

-- 2nd-trimester Salomon: FL (mm) 15–24 weeks
INSERT INTO growth_chart_data (author_id, parameter, ga_weeks, p5, p50, p95, mean, sd) VALUES
(1,'FL',15.0, 18.0, 22.0, 27.0, 22.0, 2.74),
(1,'FL',16.0, 21.0, 26.0, 31.0, 26.0, 3.03),
(1,'FL',17.0, 24.0, 29.5, 35.5, 29.5, 3.49),
(1,'FL',18.0, 28.0, 33.5, 40.0, 33.5, 3.64),
(1,'FL',19.0, 31.5, 37.5, 44.5, 37.5, 3.95),
(1,'FL',20.0, 35.0, 41.5, 49.0, 41.5, 4.24),
(1,'FL',21.0, 38.5, 45.5, 53.5, 45.5, 4.55),
(1,'FL',22.0, 42.0, 49.5, 58.0, 49.5, 4.85),
(1,'FL',23.0, 45.5, 53.5, 62.5, 53.5, 5.18),
(1,'FL',24.0, 49.0, 57.5, 67.0, 57.5, 5.49)
ON DUPLICATE KEY UPDATE p5=VALUES(p5), p50=VALUES(p50), p95=VALUES(p95), mean=VALUES(mean), sd=VALUES(sd);
