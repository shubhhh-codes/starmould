<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChallanItemsModel extends Model
{
    protected $table = 'challan_items';
    public function subplate()
    {
        return $this->belongsTo(SubplateModel::class, 'plateid');
    }
    public function customers()
    {
        return $this->belongsTo(CustomerModel::class, 'customer');
    }
    public function scanning()
    {
        return $this->belongsTo(ScanningModel::class, 'project');
    }  
}
