<?php

namespace App\Http\Controllers;
use App\Models\ScanningModel;
use Illuminate\Http\Request;
use App\Models\CustomerModel;
use App\Models\UserModel;
use App\Models\WorkModel;
use Carbon\Carbon;
use Yajra\DataTables\DataTables as DataTables;
class SampleController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        //
        return view('sample.index');
    }
    public function rework()
    {
        return view('rework.index');
    }
    public function indexmobile()
    {
        //
        $data = ScanningModel::leftJoin('customers', 'scan.cname', '=', 'customers.id')->select('scan.*','customers.customername')->where("worktype","Sample")->get();
     
        return response()->json(['status'=>true,'data' => $data], 200);
    }
    public function indexreworkmobile()
    {
        //
        $data = ScanningModel::leftJoin('customers', 'scan.cname', '=', 'customers.id')->select('scan.*','customers.customername')->where("worktype","Rework")->get();
     
        return response()->json(['status'=>true,'data' => $data], 200);
    }
    public function getData(Request $request)
    {
        if ($request->ajax()) {
            // $data = ScanningModel::latest()->where("status","pending")->get();
            $data = ScanningModel::where("worktype","Sample")->get();
            return DataTables::of($data)
            ->addIndexColumn()
            ->addColumn('cdate',function($row){
                return [
                    'display' => Carbon::parse($row->cdate)->format('d-m-Y'),
                    'timestamp' => Carbon::parse($row->cdate)->timestamp,
                ];
               // return Carbon::parse($row->cdate)->format('d-m-Y');
            })   
            ->addColumn('cname',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->cname)->get();
                $cname="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $cname=$value->initials;
                    }  
                }
                return $cname;
            })           
            ->addColumn('rdate',function($row){
                return [
                    'display' => Carbon::parse($row->rdate)->format('d-m-Y'),
                    'timestamp' => Carbon::parse($row->rdate)->timestamp,
                ];
                //return Carbon::parse($row->rdate)->format('d-m-Y');
            })
            
            ->addColumn('scan_by', function($row){
               $data1 = UserModel::latest()->where("status","1")->get();
                
                $btn3 = '<select class="form-control select2-ajax" style="padding:0px;!important" id="scanby_'.$row->id.'" onchange="return changestatusscan(\'scan_by\',this.value,\''.$row->id.'\');">';
                $btn3.='<option value="0">Select</option>';
                foreach ($data1 as $key => $value) {
                    # code...
                    if($value->id==$row->scan_by){
                        $btn3.='<option value="'.$value->id.'" selected>'.$value->initials.'</option>';
                     }else{
                     $btn3.='<option value="'.$value->id.'">'.$value->initials.'</option>';
                     }
                }
                $btn3.= '</select>';

                 return $btn3;
            })
            ->addColumn('qc_by', function($row){

                $data1 = UserModel::latest()->where("status","1")->get();
                
                $btn2 = '<select class="form-control select2-ajax" style="padding:0px;!important" id="qc_'.$row->id.'" onchange="return changestatusscan(\'qc_by\',this.value,\''.$row->id.'\');">';
                $btn2.='<option value="0">Select</option>';
                foreach ($data1 as $key => $value) {
                    # code...
                    if($value->id==$row->qc_by){
                        $btn2.='<option value="'.$value->id.'" selected>'.$value->initials.'</option>';
                     }else{
                     $btn2.='<option value="'.$value->id.'">'.$value->initials.'</option>';
                     }
                }
                $btn2.= '</select>';

                 return $btn2;
            })
            ->addColumn('modeldesign_by', function($row){

                $data1 = UserModel::latest()->where("status","1")->get();
                
                $btn1 = '<select class="form-control select2-ajax" style="padding:0px;!important" id="modeldesign_'.$row->id.'" onchange="return changestatusscan(\'modeldesign_by\',this.value,\''.$row->id.'\');">';
                $btn1.='<option value="0">Select</option>';
                foreach ($data1 as $key => $value) {
                    # code...
                    if($value->id==$row->modeldesign_by){
                        $btn1.='<option value="'.$value->id.'" selected>'.$value->initials.'</option>';
                     }else{
                     $btn1.='<option value="'.$value->id.'">'.$value->initials.'</option>';
                     }
                }
                $btn1.= '</select>';

                 return $btn1;
            })
           
           
            // ->addColumn('qc_by', function($row){

            //     $data1 = UserModel::latest()->where("role","1")->get();
                
            //     $btn2 = '<select class="form-control select2-ajax" style="padding:0px;!important" id="qc_'.$row->id.'">';
            //     $btn2.='<option value="0">Select</option>';
            //     foreach ($data1 as $key => $value) {
            //         # code...
            //         if($value->id==$row->qc_by){
            //             $btn2.='<option value="'.$value->id.'" selected>'.$value->initials.'</option>';
            //          }else{
            //          $btn2.='<option value="'.$value->id.'">'.$value->initials.'</option>';
            //          }
            //     }
            //     $btn2.= '</select>';

            //      return $btn2;
            // })
            ->addColumn("scan_hr",function($row){
                $data = WorkModel::where('scan_print_id',$row->id)->get();
                $scanhr=0;
                foreach($data as $val){
                    $scanhr+=$val->scan_hr;
                }
                return $scanhr;
            })
            ->addColumn("model_hr",function($row){
                $data = WorkModel::where('scan_print_id',$row->id)->get();
                $scanhr=0;
                foreach($data as $val){
                    $scanhr+=$val->rework_hr+$val->qc_hr+$val->insp_hr+$val->model_hr;
                }
                return $scanhr;
            })
          
         ->setRowId(function($row){

             return "scan_".$row->id;
           })
            ->rawColumns(['scan_by','qc_by','modeldesign_by'])
            
            ->make(true);
          //  return $data;                          
        }
    }
    public function getreworkData(Request $request)
    {
        if ($request->ajax()) {
            // $data = ScanningModel::latest()->where("status","pending")->get();
            $data = ScanningModel::where("worktype","Rework")->get();
            return DataTables::of($data)
            ->addIndexColumn()
            ->addColumn('cdate',function($row){
                return [
                    'display' => Carbon::parse($row->cdate)->format('d-m-Y'),
                    'timestamp' => Carbon::parse($row->cdate)->timestamp,
                ];
               // return Carbon::parse($row->cdate)->format('d-m-Y');
            })   
            ->addColumn('cname',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->cname)->get();
                $cname="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $cname=$value->initials;
                    }  
                }
                return $cname;
            })           
            ->addColumn('rdate',function($row){
                return [
                    'display' => Carbon::parse($row->rdate)->format('d-m-Y'),
                    'timestamp' => Carbon::parse($row->rdate)->timestamp,
                ];
                //return Carbon::parse($row->rdate)->format('d-m-Y');
            })
            
            ->addColumn('scan_by', function($row){
               $data1 = UserModel::latest()->where("status","1")->get();
                
                $btn3 = '<select class="form-control select2-ajax" style="padding:0px;!important" id="scanby_'.$row->id.'" onchange="return changestatusscan(\'scan_by\',this.value,\''.$row->id.'\');">';
                $btn3.='<option value="0">Select</option>';
                foreach ($data1 as $key => $value) {
                    # code...
                    if($value->id==$row->scan_by){
                        $btn3.='<option value="'.$value->id.'" selected>'.$value->initials.'</option>';
                     }else{
                     $btn3.='<option value="'.$value->id.'">'.$value->initials.'</option>';
                     }
                }
                $btn3.= '</select>';

                 return $btn3;
            })
            ->addColumn('qc_by', function($row){

                $data1 = UserModel::latest()->where("status","1")->get();
                
                $btn2 = '<select class="form-control select2-ajax" style="padding:0px;!important" id="qc_'.$row->id.'" onchange="return changestatusscan(\'qc_by\',this.value,\''.$row->id.'\');">';
                $btn2.='<option value="0">Select</option>';
                foreach ($data1 as $key => $value) {
                    # code...
                    if($value->id==$row->qc_by){
                        $btn2.='<option value="'.$value->id.'" selected>'.$value->initials.'</option>';
                     }else{
                     $btn2.='<option value="'.$value->id.'">'.$value->initials.'</option>';
                     }
                }
                $btn2.= '</select>';

                 return $btn2;
            })
            ->addColumn('modeldesign_by', function($row){

                $data1 = UserModel::latest()->where("status","1")->get();
                
                $btn1 = '<select class="form-control select2-ajax" style="padding:0px;!important" id="modeldesign_'.$row->id.'" onchange="return changestatusscan(\'modeldesign_by\',this.value,\''.$row->id.'\');">';
                $btn1.='<option value="0">Select</option>';
                foreach ($data1 as $key => $value) {
                    # code...
                    if($value->id==$row->modeldesign_by){
                        $btn1.='<option value="'.$value->id.'" selected>'.$value->initials.'</option>';
                     }else{
                     $btn1.='<option value="'.$value->id.'">'.$value->initials.'</option>';
                     }
                }
                $btn1.= '</select>';

                 return $btn1;
            })
           
           
            // ->addColumn('qc_by', function($row){

            //     $data1 = UserModel::latest()->where("role","1")->get();
                
            //     $btn2 = '<select class="form-control select2-ajax" style="padding:0px;!important" id="qc_'.$row->id.'">';
            //     $btn2.='<option value="0">Select</option>';
            //     foreach ($data1 as $key => $value) {
            //         # code...
            //         if($value->id==$row->qc_by){
            //             $btn2.='<option value="'.$value->id.'" selected>'.$value->initials.'</option>';
            //          }else{
            //          $btn2.='<option value="'.$value->id.'">'.$value->initials.'</option>';
            //          }
            //     }
            //     $btn2.= '</select>';

            //      return $btn2;
            // })
            ->addColumn("scan_hr",function($row){
                $data = WorkModel::where('scan_print_id',$row->id)->get();
                $scanhr=0;
                foreach($data as $val){
                    $scanhr+=$val->scan_hr;
                }
                return $scanhr;
            })
            ->addColumn("model_hr",function($row){
                $data = WorkModel::where('scan_print_id',$row->id)->get();
                $scanhr=0;
                foreach($data as $val){
                    $scanhr+=$val->rework_hr+$val->qc_hr+$val->insp_hr+$val->model_hr;
                }
                return $scanhr;
            })
          
         ->setRowId(function($row){

             return "scan_".$row->id;
           })
            ->rawColumns(['scan_by','qc_by','modeldesign_by'])
            
            ->make(true);
          //  return $data;                          
        }
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
        //
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
