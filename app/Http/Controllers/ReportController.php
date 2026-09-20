<?php

namespace App\Http\Controllers;

use App\Models\ScanningModel;
use App\Models\UserModel;
use App\Models\CustomerModel;
use App\Models\WorkModel;
use App\Models\PrintingModel;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Yajra\DataTables\Facades\DataTables;

class ReportController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        // 
        $now = Carbon::now();
        $resultt = $now->year;
        $resultt1 = Carbon::now()->format('m');
        if($now<Carbon::parse($resultt."-".$resultt1."-01")){
            $startDate=($resultt-1)."-".$resultt1."-01";
            $endDate=($resultt)."-".$resultt1."-31";
        }else{
            $startDate=($resultt-1)."-".$resultt1."-01";
            $endDate=($resultt)."-".$resultt1."-31";
        }

    //    $now = Carbon::now();
    //     $resultt = $now->year;
    //     if($now<Carbon::parse($resultt."-0$now->month-01")){
    //         $startDate=($resultt-1)."-0$now->month-01";
    //         $endDate=($resultt)."-0$now->month-31";
    //     }else{
    //         $startDate=($resultt-1)."-0$now->month-01";
    //         $endDate=($resultt)."-0$now->month-31";
    //     }// $re = ScanningModel::selectRaw("sum(amount) as REAmount")->where('worktype', 'R.E.')->whereDate('created_at', '>=', $startDate)->whereDate('created_at', '<=', $endDate)->selectRaw("month(created_at) as months,year(created_at) as years")->groupBy('months','years')->get();
        // $insp = ScanningModel::selectRaw("sum(amount) as InspAmount")->where('worktype', 'Insp.')->whereDate('created_at', '>=', $startDate)->whereDate('created_at', '<=', $endDate)->selectRaw("month(created_at) as months,year(created_at) as years")->groupBy('months','years')->get();
        // $scan = ScanningModel::selectRaw("sum(amount) as ScanAmount")->where('worktype', 'Scan')->whereDate('created_at', '>=', $startDate)->whereDate('created_at', '<=', $endDate)->selectRaw("month(created_at) as months,year(created_at) as years")->groupBy('months','years')->get();
        // $design = ScanningModel::selectRaw("sum(amount) as DesignAmount")->where('worktype', 'Design')->whereDate('created_at', '>=', $startDate)->whereDate('created_at', '<=', $endDate)->selectRaw("month(created_at) as months,year(created_at) as years")->groupBy('months','years')->get();
        // $scantotal = ScanningModel::selectRaw("sum(amount) as scantotal")->whereDate('created_at', '>=', $startDate)->whereDate('created_at', '<=', $endDate)->selectRaw("month(created_at) as months,year(created_at) as years")->groupBy('months','years')->get();
        // $printtotal = PrintingModel::selectRaw("sum(ramount) as printtotal")->whereDate('created_at', '>=', $startDate)->whereDate('created_at', '<=', $endDate)->selectRaw("month(created_at) as months,year(created_at) as years")->groupBy('months','years')->get();
       
        $montharray=array();
       
        $vmc=array();
        $electric=array();
        $setting=array();
        $chhol=array();
        $operator=array();
        $lunch=array();
        $noanywork=array();
       
        
        $totalamount=array();
        $totalamount1=array();
        $totalamount2=array();
        $totalhr=array();
        $totalhrs=array();
        $totalhrsten=array();
        $recount=array();
        $inspcount=array();
        $designcount=array();
        $lrscount=array();
        $dronecount=array();
        $scancount=array();
        $totalvmc=array();
        $totalelectricfault=array();
        $totalsetting=array();
        $totalchhol=array();
        $totaloperator=array();
        $totallunch=array();
        $totalnoanywork=array();
        // $printcount=array();
        foreach (CarbonPeriod::create($startDate, '1 month', $endDate) as $month) {
        
            $vmctemp = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as vmctime, MONTH(rdate) as months, YEAR(rdate) as years")
            ->where('projectid', '0113_STM_002')
            ->where('customerid', '112')
            ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
            ->groupBy('months', 'years')
            ->get();
            foreach ($vmctemp as $key => $value) {
                # code...
                array_push($vmc,(float)$value->vmctime);
            }
            if(count($vmctemp)==0){
                array_push($vmc,(float)0);
            }
            $electrictemp = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as eletime, MONTH(rdate) as months, YEAR(rdate) as years")
            ->where('projectid', '0114_STM_003')
            ->where('customerid', '112')
            ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
            ->groupBy('months', 'years')
            ->get();
            foreach ($electrictemp as $key => $value) {
                # code...
                array_push($electric,(float)$value->eletime);
            }
            if(count($electrictemp)==0){
                array_push($electric,(float)0);
            }
            $settingtemp = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as settingtime, MONTH(rdate) as months, YEAR(rdate) as years")
            ->where('projectid', '0115_STM_004')
            ->where('customerid', '112')
            ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
            ->groupBy('months', 'years')
            ->get();
            foreach ($settingtemp as $key => $value) {
                # code...
                array_push($setting,(float)$value->settingtime);
            }
            if(count($settingtemp)==0){
                array_push($setting,(float)0);
            }
            $chholtemp = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as chholtime, MONTH(rdate) as months, YEAR(rdate) as years")
            ->where('projectid', '0116_STM_005')
            ->where('customerid', '112')
            ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
            ->groupBy('months', 'years')
            ->get();
            foreach ($chholtemp as $key => $value) {
                # code...
                array_push($chhol,(float)$value->chholtime);
            }
            if(count($chholtemp)==0){
                array_push($chhol,(float)0);
            }
           
            $operatortemp = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as operatortime, MONTH(rdate) as months, YEAR(rdate) as years")
        
            ->where('projectid', '0117_STM_006')
            ->where('customerid', '112')
            ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
            ->groupBy('months', 'years')
            ->get();
            foreach ($operatortemp as $key => $value) {
                # code...
                array_push($operator,(float)$value->operatortime);
            }
            if(count($operatortemp)==0){
                array_push($operator,(float)0);
            }
            $lunchtemp = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as lunchtime, MONTH(rdate) as months, YEAR(rdate) as years")
                ->where('projectid', '0120_STM_007')
                ->where('customerid', '112')
                ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
                ->groupBy('months', 'years')
                ->get();
                foreach ($lunchtemp as $key => $value) {
                    # code...
                    array_push($lunch,(float)$value->lunchtime);
                }
                if(count($lunchtemp)==0){
                    array_push($lunch,(float)0);
                }    
            $noanyworktemp = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as noanyworktime, MONTH(rdate) as months, YEAR(rdate) as years")
                ->where('projectid', '0130_STM_008')
                ->where('customerid', '112')
                ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
                ->groupBy('months', 'years')
                ->get();
                foreach ($noanyworktemp as $key => $value) {
                    # code...
                    array_push($noanywork,(float)$value->noanyworktime);
                }
                if(count($noanyworktemp)==0){
                    array_push($noanywork,(float)0);
                }    
            // $printcounttemp = PrintingModel::selectRaw("count(*) as printcount")->whereRaw('MONTH(created_at) = ? and YEAR(created_at)=?',[$month->format('m'),$month->format('Y')])->selectRaw("month(created_at) as months,year(created_at) as years")->groupBy('months','years')->get();
            // $temptotal1=0;
            // foreach ($printcounttemp as $key => $value) {
            //     # code...
            //     array_push($printcount,$value->printcount);
            //     $temptotal1+=$value->printcount;
            // }
            // if(count($printcounttemp)==0){
            //     array_push($printcount,(float)0);
            // }
            $noworktemp = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as totalvmc, MONTH(rdate) as months, YEAR(rdate) as years")
            ->where('projectid', '0113_STM_002')
            ->where('customerid', '112')
            ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
            ->groupBy('months', 'years')
            ->get();
             $temptotal2 = 0;

            foreach ($noworktemp as $key => $value) {
                $totalHours = (float)($value->totalvmc); // Convert seconds to hours
                $roundedvmcHours = round($totalHours, 2); 
                array_push($totalvmc, $roundedvmcHours);
                $temptotal2 += $roundedvmcHours;
            }

            if (count($noworktemp) == 0) {
                array_push($totalvmc, (float)0);
            }
            $noworktempelectric = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as totalelectricfault, MONTH(rdate) as months, YEAR(rdate) as years")
                ->where('projectid', '0114_STM_003')
                ->where('customerid', '112')
                ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
                ->groupBy('months', 'years')
                ->get();


            foreach ($noworktempelectric as $key => $value) {
                $totalFaultHours = (float)($value->totalelectricfault); // Convert seconds to hours
                $roundedelectricHours = round($totalFaultHours, 2); 
                array_push($totalelectricfault, $roundedelectricHours);
                $temptotal2 += $roundedelectricHours;
            }

            if (count($noworktempelectric) == 0) {
                array_push($totalelectricfault, (float)0);
            }
        $noworktempsetting = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as totalsetting, MONTH(rdate) as months, YEAR(rdate) as years")
            ->where('projectid', '0115_STM_004')
            ->where('customerid', '112')
            ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
            ->groupBy('months', 'years')
            ->get();


        foreach ($noworktempsetting as $key => $value) {
            $totalsettingHours = (float)($value->totalsetting); // Convert seconds to hours
            $roundedsettingHours = round($totalsettingHours, 2); 
            array_push($totalsetting, $roundedsettingHours);
            $temptotal2 += $roundedsettingHours;
        }

        if (count($noworktempsetting) == 0) {
            array_push($totalsetting, (float)0);
        }
        $noworktempchhol = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as totalchhol, MONTH(rdate) as months, YEAR(rdate) as years")
                ->where('projectid', '0116_STM_005')
                ->where('customerid', '112')
                ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
                ->groupBy('months', 'years')
                ->get();


            foreach ($noworktempchhol as $key => $value) {
                $totalchholHours = (float)($value->totalchhol); // Convert seconds to hours.
                $roundedchholHours = round($totalchholHours, 2); 
                array_push($totalchhol, $roundedchholHours);
                $temptotal2 += $roundedchholHours;
            }

            if (count($noworktempchhol) == 0) {
                array_push($totalchhol, (float)0);
            } 
        $noworktempoperator = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as totaloperator, MONTH(rdate) as months, YEAR(rdate) as years")
        
            ->where('projectid', '0117_STM_006')
            ->where('customerid', '112')
            ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
            ->groupBy('months', 'years')
            ->get();


        foreach ($noworktempoperator as $key => $value) {
            $totalHoursOperator = (float)($value->totaloperator); // Convert seconds to hours
            $roundedoperatorHours = round($totalHoursOperator, 2); 
            array_push($totaloperator, $roundedoperatorHours);
            $temptotal2 += $roundedoperatorHours;
        }

        if (count($noworktempoperator) == 0) {
            array_push($totaloperator, (float)0);
        }

        $noworktemplunch = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as totallunch, MONTH(rdate) as months, YEAR(rdate) as years")
                ->where('projectid', '0120_STM_007')
                ->where('customerid', '112')
                ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
                ->groupBy('months', 'years')
                ->get();
            foreach ($noworktemplunch as $key => $value) {
                $totallunchHours = (float)($value->totallunch); // Convert seconds to hours
                $roundednoHours = round($totallunchHours, 2); 
                array_push($totallunch, $roundednoHours);
                $temptotal2 += $roundednoHours;
            }

            if (count($noworktemplunch) == 0) {
                array_push($totallunch, (float)0);
            }
        // $noworktemplunch = WorkModel::selectRaw("sum(work_hr) as totallunch")->where('projectid', '0120_STM_007')->where('customerid','112')->whereRaw('MONTH(rdate) = ? and YEAR(rdate)=?',[$month->format('m'),$month->format('Y')])->selectRaw("month(rdate) as months,year(rdate) as years")->groupBy('months','years')->get();
        // // $temptotal2=0;
        // foreach ($noworktemplunch as $key => $value) {
        //     # code...
        //     array_push($totallunch,$value->totallunch);
        //     $temptotal2 +=$value->totallunch;
        // }
        // if(count($noworktemplunch)==0){
        //     array_push($totallunch,(float)0);
        // }
        // 
        $noworktempnoanywork = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as totalnoanywork, MONTH(rdate) as months, YEAR(rdate) as years")
            ->where('projectid', '0130_STM_008')
            ->where('customerid', '112')
            ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
            ->groupBy('months', 'years')
            ->get();

        foreach ($noworktempnoanywork as $key => $value) {
            $totalHours = (float)($value->totalnoanywork); // Convert seconds to hours
            $roundedTotalHours = round($totalHours, 2); 
            array_push($totalnoanywork, $roundedTotalHours);
            $temptotal2 += $roundedTotalHours;
        }

        if (count($noworktempnoanywork) == 0) {
            array_push($totalnoanywork, (float)0);
        }
               
                array_push($totalamount2,$temptotal2);
               array_push($montharray,$month->format('M,Y'));
        }
        if(Auth::user()->role == 0){
        return view('report.index',["totalamount"=>$totalamount,"totalamount1"=>$totalamount1,"totalamount2"=>$totalamount2,"totalvmc"=>$totalvmc,"totalelectricfault"=>$totalelectricfault,"totalsetting"=>$totalsetting,"totalchhol"=>$totalchhol,"totaloperator"=>$totaloperator,"totallunch"=>$totallunch,"totalnoanywork"=>$totalnoanywork,"startDate"=>$now<Carbon::parse($resultt."-".$resultt1."-01")?($resultt-1)."-".$resultt1:($resultt-1)."-".$resultt1,"endDate"=>$now<Carbon::parse($resultt."-".$resultt1."-01")?($resultt)."-".$resultt1:($resultt)."-".$resultt1,"months"=>$montharray,"vmc"=>$vmc,"electric"=>$electric,"setting"=>$setting,"chhol"=>$chhol,"operator"=>$operator,"lunch"=>$lunch,"noanywork"=>$noanywork,"scancount"=>$scancount,"recount"=>$recount,"inspcount"=>$inspcount,"designcount"=>$designcount,"lrscount"=>$lrscount,"dronecount"=>$dronecount]);                                                                                  
        }
        else{
            return back();
        }// return view('report.index',["totalamount"=>$totalamount,"totalamount1"=>$totalamount1,"startDate"=>$now<Carbon::parse($resultt."-0$now->month-01")?($resultt-1)."-0$now->month":($resultt-1)."-0$now->month","endDate"=>$now<Carbon::parse($resultt."-0$now->month-01")?($resultt)."-0$now->month":($resultt)."-0$now->month","months"=>$montharray,"re"=>$re,"insp"=>$insp,"scan"=>$scan,"design"=>$design,"lrs"=>$lrs,"drone"=>$drone,"scantotal"=>$scantotal,"scantotall"=>$scantotall,"printtotal"=>$printtotal,"scancount"=>$scancount,"printcount"=>$printcount,"recount"=>$recount,"inspcount"=>$inspcount,"designcount"=>$designcount,"lrscount"=>$lrscount,"dronecount"=>$dronecount]);
    }
    public function getmonthwisedata(Request $request)
    {
        //$result = PrintingModel::selectRaw('year(created_at) year')->groupBy('year')->orderBy('created_at', 'asc')->pluck('year');
       // $result1 = ScanningModel::selectRaw('year(created_at) year')->groupBy('year')->orderBy('created_at', 'asc')->pluck('year');
      //  $now = Carbon::now();
      //  $resultt = $now->year;
        $startDate=$request->startdate."-01";
        $end = new Carbon($request->enddate."-01");
       

        $endDate=$request->enddate."-".$end->endOfMonth()->format('d');
        $montharray=array();
        $vmc=array();
        $electric=array();
        $setting=array();
        $chhol=array();
        $operator=array();
        $lunch=array();
        $noanywork=array();
        $totalamount=array();
        $totalamount1=array();
        $totalamount2=array();
        $recount=array();
        $inspcount=array();
        $designcount=array();
        $lrscount=array();
        $dronecount=array();
        $scancount=array();
        $totalvmc=array();
        $totalelectricfault=array();
        $totalsetting=array();
        $totalchhol=array();
        $totaloperator=array();
        $totallunch=array();
        $totalnoanywork=array();
        foreach (CarbonPeriod::create($startDate, '1 month', $endDate) as $month) {
            $vmctemp = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as vmctime, MONTH(rdate) as months, YEAR(rdate) as years")
            ->where('projectid', '0113_STM_002')
            ->where('customerid', '112')
            ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
            ->groupBy('months', 'years')
            ->get();
            foreach ($vmctemp as $key => $value) {
                # code...
                array_push($vmc,(float)$value->vmctime);
            }
            if(count($vmctemp)==0){
                array_push($vmc,(float)0);
            }
            $electrictemp = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as eletime, MONTH(rdate) as months, YEAR(rdate) as years")
            ->where('projectid', '0114_STM_003')
            ->where('customerid', '112')
            ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
            ->groupBy('months', 'years')
            ->get();
            foreach ($electrictemp as $key => $value) {
                # code...
                array_push($electric,(float)$value->eletime);
            }
            if(count($electrictemp)==0){
                array_push($electric,(float)0);
            }
            $settingtemp = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as settingtime, MONTH(rdate) as months, YEAR(rdate) as years")
            ->where('projectid', '0115_STM_004')
            ->where('customerid', '112')
            ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
            ->groupBy('months', 'years')
            ->get();
            foreach ($settingtemp as $key => $value) {
                # code...
                array_push($setting,(float)$value->settingtime);
            }
            if(count($settingtemp)==0){
                array_push($setting,(float)0);
            }
            $chholtemp = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as chholtime, MONTH(rdate) as months, YEAR(rdate) as years")
            ->where('projectid', '0116_STM_005')
            ->where('customerid', '112')
            ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
            ->groupBy('months', 'years')
            ->get();
            foreach ($chholtemp as $key => $value) {
                # code...
                array_push($chhol,(float)$value->chholtime);
            }
            if(count($chholtemp)==0){
                array_push($chhol,(float)0);
            }
           
            $operatortemp = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as operatortime, MONTH(rdate) as months, YEAR(rdate) as years")
        
            ->where('projectid', '0117_STM_006')
            ->where('customerid', '112')
            ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
            ->groupBy('months', 'years')
            ->get();
            foreach ($operatortemp as $key => $value) {
                # code...
                array_push($operator,(float)$value->operatortime);
            }
            if(count($operatortemp)==0){
                array_push($operator,(float)0);
            }
            $lunchtemp = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as lunchtime, MONTH(rdate) as months, YEAR(rdate) as years")
                ->where('projectid', '0120_STM_007')
                ->where('customerid', '112')
                ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
                ->groupBy('months', 'years')
                ->get();
                foreach ($lunchtemp as $key => $value) {
                    # code...
                    array_push($lunch,(float)$value->lunchtime);
                }
                if(count($lunchtemp)==0){
                    array_push($lunch,(float)0);
                }    
            $noanyworktemp = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as noanyworktime, MONTH(rdate) as months, YEAR(rdate) as years")
                ->where('projectid', '0130_STM_008')
                ->where('customerid', '112')
                ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
                ->groupBy('months', 'years')
                ->get();
                foreach ($noanyworktemp as $key => $value) {
                    # code...
                    array_push($noanywork,(float)$value->noanyworktime);
                }
                if(count($noanyworktemp)==0){
                    array_push($noanywork,(float)0);
                }    
           
          $noworktemp = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as totalvmc, MONTH(rdate) as months, YEAR(rdate) as years")
                ->where('projectid', '0113_STM_002')
                ->where('customerid', '112')
                ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
                ->groupBy('months', 'years')
                ->get();
            $temptotal2 = 0;

            foreach ($noworktemp as $key => $value) {
                $totalHours = (float)($value->totalvmc); // Convert seconds to hours
                $roundedvmcHours = round($totalHours, 2); 
                array_push($totalvmc, $roundedvmcHours);
                $temptotal2 += $roundedvmcHours;
            }

            if (count($noworktemp) == 0) {
                array_push($totalvmc, (float)0);
            }
            $noworktempelectric = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as totalelectricfault, MONTH(rdate) as months, YEAR(rdate) as years")
                ->where('projectid', '0114_STM_003')
                ->where('customerid', '112')
                ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
                ->groupBy('months', 'years')
                ->get();


            foreach ($noworktempelectric as $key => $value) {
                $totalFaultHours = (float)($value->totalelectricfault); // Convert seconds to hours
                $roundedelectricHours = round($totalFaultHours, 2); 
                array_push($totalelectricfault, $roundedelectricHours);
                $temptotal2 += $roundedelectricHours;
            }

            if (count($noworktempelectric) == 0) {
                array_push($totalelectricfault, (float)0);
            }
            $noworktempsetting = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as totalsetting, MONTH(rdate) as months, YEAR(rdate) as years")
                ->where('projectid', '0115_STM_004')
                ->where('customerid', '112')
                ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
                ->groupBy('months', 'years')
                ->get();


            foreach ($noworktempsetting as $key => $value) {
                $totalsettingHours = (float)($value->totalsetting); // Convert seconds to hours
                $roundedsettingHours = round($totalsettingHours, 2); 
                array_push($totalsetting, $roundedsettingHours);
                $temptotal2 += $roundedsettingHours;
            }

            if (count($noworktempsetting) == 0) {
                array_push($totalsetting, (float)0);
            }
            $noworktempchhol = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as totalchhol, MONTH(rdate) as months, YEAR(rdate) as years")
                    ->where('projectid', '0116_STM_005')
                    ->where('customerid', '112')
                    ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
                    ->groupBy('months', 'years')
                    ->get();


                foreach ($noworktempchhol as $key => $value) {
                    $totalchholHours = (float)($value->totalchhol); // Convert seconds to hours.
                    $roundedchholHours = round($totalchholHours, 2); 
                    array_push($totalchhol, $roundedchholHours);
                    $temptotal2 += $roundedchholHours;
                }

                if (count($noworktempchhol) == 0) {
                    array_push($totalchhol, (float)0);
                } 
            $noworktempoperator = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as totaloperator, MONTH(rdate) as months, YEAR(rdate) as years")
            
                ->where('projectid', '0117_STM_006')
                ->where('customerid', '112')
                ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
                ->groupBy('months', 'years')
                ->get();


            foreach ($noworktempoperator as $key => $value) {
                $totalHoursOperator = (float)($value->totaloperator); // Convert seconds to hours
                $roundedoperatorHours = round($totalHoursOperator, 2); 
                array_push($totaloperator, $roundedoperatorHours);
                $temptotal2 += $roundedoperatorHours;
            }

            if (count($noworktempoperator) == 0) {
                array_push($totaloperator, (float)0);
            }

            $noworktemplunch = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as totallunch, MONTH(rdate) as months, YEAR(rdate) as years")
                    ->where('projectid', '0120_STM_007')
                    ->where('customerid', '112')
                    ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
                    ->groupBy('months', 'years')
                    ->get();
                foreach ($noworktemplunch as $key => $value) {
                    $totallunchHours = (float)($value->totallunch); // Convert seconds to hours
                    $roundednoHours = round($totallunchHours, 2); 
                    array_push($totallunch, $roundednoHours);
                    $temptotal2 += $roundednoHours;
                }

                if (count($noworktemplunch) == 0) {
                    array_push($totallunch, (float)0);
                }
            // $noworktemplunch = WorkModel::selectRaw("sum(work_hr) as totallunch")->where('projectid', '0120_STM_007')->where('customerid','112')->whereRaw('MONTH(rdate) = ? and YEAR(rdate)=?',[$month->format('m'),$month->format('Y')])->selectRaw("month(rdate) as months,year(rdate) as years")->groupBy('months','years')->get();
            // // $temptotal2=0;
            // foreach ($noworktemplunch as $key => $value) {
            //     # code...
            //     array_push($totallunch,$value->totallunch);
            //     $temptotal2 +=$value->totallunch;
            // }
            // if(count($noworktemplunch)==0){
            //     array_push($totallunch,(float)0);
            // }
            // 
            $noworktempnoanywork = WorkModel::selectRaw("SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr))) as totalnoanywork, MONTH(rdate) as months, YEAR(rdate) as years")
                ->where('projectid', '0130_STM_008')
                ->where('customerid', '112')
                ->whereRaw('MONTH(rdate) = ? and YEAR(rdate) = ?', [$month->format('m'), $month->format('Y')])
                ->groupBy('months', 'years')
                ->get();

            foreach ($noworktempnoanywork as $key => $value) {
                $totalHours = (float)($value->totalnoanywork); // Convert seconds to hours
                $roundedTotalHours = round($totalHours, 2); 
                array_push($totalnoanywork, $roundedTotalHours);
                $temptotal2 += $roundedTotalHours;
            }

            if (count($noworktempnoanywork) == 0) {
                array_push($totalnoanywork, (float)0);
            }

            // $totalnoanywork now contains the sum of work hours in proper format

            // Output the result for debugging
            // var_dump($totalnoanywork);
                
                array_push($totalamount2,$temptotal2);
               array_push($montharray,$month->format('M,Y'));
        }
        
        print_r(json_encode(["months"=>$montharray,"totalvmc"=>$totalvmc,"totalelectricfault"=>$totalelectricfault,"totalsetting"=>$totalsetting,"totalchhol"=>$totalchhol,"totaloperator"=>$totaloperator,"totallunch"=>$totallunch,"totalnoanywork"=>$totalnoanywork,"vmc"=>$vmc,"electric"=>$electric,"setting"=>$setting,"chhol"=>$chhol,"operator"=>$operator,"lunch"=>$lunch,"noanywork"=>$noanywork,"totalamount"=>$totalamount,"totalamount1"=>$totalamount1,"totalamount2"=>$totalamount2,"scancount"=>$scancount,"recount"=>$recount,"inspcount"=>$inspcount,"designcount"=>$designcount,"lrscount"=>$lrscount,"dronecount"=>$dronecount]));
       // return view('report.index',["startDate"=>($resultt-1)."-04","endDate"=>$resultt."-03","months"=>$montharray,"result"=>$result,"resultt"=>$resultt,"result1"=>$result1,"re"=>$re,"insp"=>$insp,"scan"=>$scan,"design"=>$design,"scantotal"=>$scantotal,"printtotal"=>$printtotal]);
   
    }
    public function getData(Request $request)
    {
        
    }
    public function getWork(Request $request)
    {
       
    }
    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
         dd($request);
    }
  
   
    //  }
    public function updatestatus(Request $request){
        // dd($request);
       
     }
    /**
     * Display the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function show($id)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function edit($id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        //
     
    }
}
