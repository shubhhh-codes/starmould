<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InwardItemsModel extends Model
{
    protected $table = 'inward_items';
    public function subplate()
    {
        return $this->belongsTo(SubplateModel::class, 'plateid');
    }
}
