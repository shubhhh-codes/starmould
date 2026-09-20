@echo off
For /f "tokens=1-3 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%b-%%a)
For /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)

C:\xampp\mysql\bin\mysqldump --user=root --password= --databases sm_prod_080723 --result-file=E:\SM_soft_backup\sm_prod_080723_%mydate%_%mytime%.sql
C:\xampp\mysql\bin\mysqldump --user=root --password= --databases sm_prod_080723 --result-file=C:\SM_soft_backup\sm_prod_080723_%mydate%_%mytime%.sql