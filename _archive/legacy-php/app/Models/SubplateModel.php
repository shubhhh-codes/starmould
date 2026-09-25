<?php

namespace App\Models;
use App\Models\ScanningModel;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
class SubplateModel extends Model
{
    use SoftDeletes;
    protected $table = 'subplate';
    protected $guarded = [];
    
    public function scan()
    {
        return $this->belongsTo(ScanningModel::class, 'projectid');
    }
    public function subPlates()
    {
        return $this->hasMany(SubplateModel::class, 'projectid', 'projectid'); // Assuming 'pid' is the foreign key in PurchaseItem table
    }
   
}
